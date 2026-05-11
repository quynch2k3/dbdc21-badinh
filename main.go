package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

// === HỆ THỐNG UPLOAD VIDEO KHÔNG GIỚI HẠN DUNG LƯỢNG ===
type VideoUploadSession struct {
	Filename    string
	FilePath    string
	TotalSize   int64
	ChunkSize   int64
	TotalChunks int
	Written     int64
	CreatedAt   time.Time
}

var (
	videoSessions   = make(map[string]*VideoUploadSession)
	videoSessionsMu sync.Mutex
)

func main() {
	app := pocketbase.New()

	// 1. BẮT SỰ KIỆN TRƯỚC KHI KHỞI ĐỘNG SERVER
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {

		// 1. CẤU HÌNH CORS CHUẨN (Official Echo Middleware)
		e.Router.Use(middleware.CORSWithConfig(middleware.CORSConfig{
			AllowOrigins: []string{"*"},
			AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions, http.MethodHead},
			AllowHeaders: []string{
				echo.HeaderOrigin,
				echo.HeaderContentType,
				echo.HeaderAccept,
				echo.HeaderAuthorization,
				echo.HeaderXRequestedWith,
			},
			MaxAge: 86400,
		}))



		// API Health Check
		e.Router.GET("/api/health", func(c echo.Context) error {
			return c.JSON(200, map[string]interface{}{
				"status": "online",
				"time":   time.Now().Format(time.RFC3339),
				"cors":   "enabled",
			})
		})

		// TẠO CUSTOM ROUTE: LƯU LOG BẢO MẬT
		e.Router.AddRoute(echo.Route{
			Method: http.MethodPost,
			Path:   "/api/secure-log",
			Handler: func(c echo.Context) error {
				var data struct {
					Reason string `json:"reason"`
					URL    string `json:"url"`
					Agent  string `json:"agent"`
				}
				if err := c.Bind(&data); err != nil {
					return apis.NewBadRequestError("Dữ liệu không hợp lệ", err)
				}
				clientIP := c.RealIP()
				collection, err := app.Dao().FindCollectionByNameOrId("security_logs")
				if err != nil {
					return apis.NewNotFoundError("Không tìm thấy collection", err)
				}
				record := models.NewRecord(collection)
				record.Set("reason", data.Reason)
				record.Set("url", data.URL)
				record.Set("agent", data.Agent)
				record.Set("ip", clientIP)
				if err := app.Dao().SaveRecord(record); err != nil {
					return apis.NewBadRequestError("Lỗi lưu DB", err)
				}
				return c.JSON(http.StatusOK, map[string]string{"message": "Đã lưu log an toàn qua Go"})
			},
		})

		// TẠO CUSTOM ROUTE: LẤY TIN TỨC THEO ĐƠN VỊ (Tăng tốc độ cho trang chủ)
		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/unit-news/:unit",
			Handler: func(c echo.Context) error {
				unit := c.PathParam("unit")

				// Truy vấn 5 bài viết mới nhất thuộc category này
				records, err := app.Dao().FindRecordsByFilter(
					"articles",
					"category = {:unit} && status = 'published'",
					"-created",
					5,
					0,
					map[string]interface{}{"unit": unit},
				)

				if err != nil {
					return apis.NewBadRequestError("Lỗi truy vấn tin tức", err)
				}

				return c.JSON(http.StatusOK, records)
			},
		})

		// ===== GOOGLE PHOTOS IMPORT V3 - HỖ TRỢ CẢ ẢNH VÀ VIDEO =====
		e.Router.AddRoute(echo.Route{
			Method: http.MethodPost,
			Path:   "/api/google-photos-import",
			Handler: func(c echo.Context) error {
				var data struct {
					URL string `json:"url"`
				}
				if err := c.Bind(&data); err != nil {
					return c.JSON(http.StatusBadRequest, map[string]string{"error": "Dữ liệu không hợp lệ"})
				}
				if data.URL == "" {
					return c.JSON(http.StatusBadRequest, map[string]string{"error": "Thiếu URL"})
				}

				log.Printf("[GPhoto] Bắt đầu: %s\n", data.URL)

				// BƯỚC 1: Follow redirect
				targetURL := data.URL
				if strings.Contains(targetURL, "photos.app.goo.gl") {
					nrc := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(r *http.Request, v []*http.Request) error { return http.ErrUseLastResponse }}
					if r, e := nrc.Get(targetURL); e == nil {
						defer r.Body.Close()
						if loc := r.Header.Get("Location"); loc != "" {
							targetURL = loc
							log.Printf("[GPhoto] Redirect → %s\n", targetURL)
						}
					}
				}

				// BƯỚC 2: Fetch trang
				httpClient := &http.Client{Timeout: 20 * time.Second}
				req, _ := http.NewRequest("GET", targetURL, nil)
				req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
				req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
				req.Header.Set("Accept-Language", "en-US,en;q=0.9")

				resp, err := httpClient.Do(req)
				if err != nil {
					return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Không thể tải trang"})
				}
				defer resp.Body.Close()
				body, _ := io.ReadAll(resp.Body)
				html := string(body)
				log.Printf("[GPhoto] Đã tải HTML: %d bytes\n", len(html))

				// BƯỚC 3: Trích xuất ẢNH
				var imageURL string
				reOg := regexp.MustCompile(`property="og:image"\s+content="([^"]+)"`)
				if m := reOg.FindStringSubmatch(html); len(m) > 1 {
					imageURL = m[1]
				}
				if imageURL == "" {
					reOg2 := regexp.MustCompile(`content="([^"]+)"\s+property="og:image"`)
					if m := reOg2.FindStringSubmatch(html); len(m) > 1 {
						imageURL = m[1]
					}
				}
				if imageURL == "" {
					rePw := regexp.MustCompile(`https://lh3\.googleusercontent\.com/pw/[a-zA-Z0-9\-_/=]+`)
					imageURL = rePw.FindString(html)
				}
				if imageURL == "" {
					reAny := regexp.MustCompile(`https://lh3\.googleusercontent\.com/[a-zA-Z0-9\-_/=]{20,}`)
					imageURL = reAny.FindString(html)
				}

				// BƯỚC 4: Trích xuất VIDEO
				isVideo := strings.Contains(html, "og:video") || strings.Contains(html, `"video"`) || strings.Contains(html, "video_url") || strings.Contains(html, "og:video:type")
				var videoURL string

				if isVideo {
					// Tìm og:video
					reVid := regexp.MustCompile(`property="og:video"\s+content="([^"]+)"`)
					if m := reVid.FindStringSubmatch(html); len(m) > 1 {
						videoURL = m[1]
						log.Printf("[GPhoto] og:video: %s\n", videoURL)
					}
					if videoURL == "" {
						reVid2 := regexp.MustCompile(`content="([^"]+)"\s+property="og:video"`)
						if m := reVid2.FindStringSubmatch(html); len(m) > 1 {
							videoURL = m[1]
						}
					}
					// Tìm video-downloads URL
					if videoURL == "" {
						reVDL := regexp.MustCompile(`https://video-downloads\.googleusercontent\.com/[^"'\s\\]+`)
						videoURL = reVDL.FindString(html)
						if videoURL != "" {
							log.Printf("[GPhoto] video-downloads URL: %s\n", videoURL)
						}
					}
					// Tìm URL videoplayback
					if videoURL == "" {
						reVPB := regexp.MustCompile(`https://[a-z0-9\-]+\.googlevideo\.com/videoplayback[^"'\s\\]+`)
						videoURL = reVPB.FindString(html)
					}
					// Tìm link lh3 dạng video trong embedded data (chứa dấu hiệu video)
					if videoURL == "" {
						reVLh3 := regexp.MustCompile(`"(https://lh3\.googleusercontent\.com/[^"]+)"[^}]*"video/mp4"`)
						if m := reVLh3.FindStringSubmatch(html); len(m) > 1 {
							videoURL = m[1]
						}
					}
					log.Printf("[GPhoto] isVideo=%v, videoURL=%s\n", isVideo, videoURL)
				}

				if imageURL == "" && videoURL == "" {
					return c.JSON(http.StatusNotFound, map[string]string{"error": "Không tìm thấy nội dung"})
				}

				// Hàm helper: tải file + lưu vào PocketBase
				saveMedia := func(downloadURL string, fileExt string) (string, error) {
					dlClient := &http.Client{Timeout: 120 * time.Second}
					dlReq, _ := http.NewRequest("GET", downloadURL, nil)
					dlReq.Header.Set("User-Agent", "Mozilla/5.0")
					dlResp, err := dlClient.Do(dlReq)
					if err != nil {
						return "", err
					}
					defer dlResp.Body.Close()

					fileData, err := io.ReadAll(dlResp.Body)
					if err != nil || len(fileData) < 1000 {
						return "", fmt.Errorf("file too small or error: %v", err)
					}
					log.Printf("[GPhoto] Đã tải: %d bytes, Content-Type: %s\n", len(fileData), dlResp.Header.Get("Content-Type"))

					// Xác định extension
					ct := dlResp.Header.Get("Content-Type")
					if fileExt == "" {
						if strings.Contains(ct, "video") {
							fileExt = ".mp4"
						} else if strings.Contains(ct, "png") {
							fileExt = ".png"
						} else if strings.Contains(ct, "webp") {
							fileExt = ".webp"
						} else {
							fileExt = ".jpg"
						}
					}
					fname := fmt.Sprintf("gphoto_%d%s", time.Now().UnixMilli(), fileExt)

					mediaColl, err := app.Dao().FindCollectionByNameOrId("media")
					if err != nil {
						mediaColl = &models.Collection{
							Name: "media", Type: models.CollectionTypeBase,
							Schema: schema.NewSchema(
								&schema.SchemaField{Name: "file", Type: schema.FieldTypeFile, Options: &schema.FileOptions{MaxSelect: 1, MaxSize: 209715200}},
								&schema.SchemaField{Name: "original_url", Type: schema.FieldTypeText},
								&schema.SchemaField{Name: "source_type", Type: schema.FieldTypeText},
							),
							ListRule: func() *string { s := ""; return &s }(),
							ViewRule: func() *string { s := ""; return &s }(),
						}
						app.Dao().SaveCollection(mediaColl)
					}

					record := models.NewRecord(mediaColl)
					// Ghi file tạm
					tmpFile, err := os.CreateTemp("", "gphoto_*_"+fname)
					if err != nil {
						return "", err
					}
					tmpFile.Write(fileData)
					tmpFile.Close()
					defer os.Remove(tmpFile.Name())

					f, err := filesystem.NewFileFromPath(tmpFile.Name())
					if err != nil {
						return "", err
					}
					f.OriginalName = fname
					record.Set("file", f)
					record.Set("original_url", data.URL)
					record.Set("source_type", "google_photos")
					if err := app.Dao().SaveRecord(record); err != nil {
						return "", err
					}
					return "/api/files/" + record.Collection().Id + "/" + record.Id + "/" + record.GetString("file"), nil
				}

				// BƯỚC 5: Tải và lưu
				result := map[string]interface{}{
					"is_video":    isVideo,
					"saved_local": false,
					"share_url":   data.URL,
				}

				// Nếu là video VÀ có video URL → tải video
				if isVideo && videoURL != "" {
					if localURL, err := saveMedia(videoURL, ".mp4"); err == nil {
						result["video_url"] = localURL
						result["saved_local"] = true
						log.Printf("[GPhoto] ✅ Đã lưu VIDEO: %s\n", localURL)
					}
				}

				// Tải ảnh (thumbnail hoặc ảnh gốc)
				if imageURL != "" {
					imgDL := imageURL
					if !strings.Contains(imgDL, "=w") && !strings.Contains(imgDL, "=s") {
						imgDL += "=w1600"
					}
					if localURL, err := saveMedia(imgDL, ""); err == nil {
						result["url"] = localURL
						if !isVideo {
							result["saved_local"] = true
						}
						log.Printf("[GPhoto] ✅ Đã lưu ẢNH: %s\n", localURL)
					} else {
						result["url"] = imgDL
					}
				}

				if result["url"] == nil && result["video_url"] == nil {
					result["url"] = imageURL
				}

				log.Printf("[GPhoto] Kết quả: %+v\n", result)
				return c.JSON(http.StatusOK, result)
			},
		})

		// SERVE LOCAL POCKETBASE SDK Bypassing Browser Blocking
		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/node_modules/pocketbase/dist/pocketbase.umd.js",
			Handler: func(c echo.Context) error {
				return c.File("node_modules/pocketbase/dist/pocketbase.umd.js")
			},
		})

		// [TỰ ĐỘNG TẠO CẤU TRÚC DỮ LIỆU NẾU CHƯA CÓ]
		ptr := func(s string) *string { return &s }
		createCollection := func(name string, fields ...*schema.SchemaField) *models.Collection {
			collection, err := app.Dao().FindCollectionByNameOrId(name)
			if err != nil {
				collection = &models.Collection{
					Name:       name,
					Type:       models.CollectionTypeBase,
					ListRule:   ptr(""),
					ViewRule:   ptr(""),
					CreateRule: ptr(""),
					UpdateRule: ptr(""),
					DeleteRule: ptr(""),
					Schema:     schema.NewSchema(fields...),
				}
				app.Dao().SaveCollection(collection)
				log.Println("Tự động tạo bảng:", name)
			}
			return collection
		}

		// Tạo bảng Tin Tức (Đảm bảo có trường 'image' cho đúng với admin.js)
		articlesColl := createCollection("articles",
			&schema.SchemaField{Name: "title", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "summary", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "content", Type: schema.FieldTypeEditor},
			&schema.SchemaField{Name: "category", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "image", Type: schema.FieldTypeFile, Options: &schema.FileOptions{MaxSelect: 1, MaxSize: 5242880}},
			&schema.SchemaField{Name: "video", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "views", Type: schema.FieldTypeNumber},
			&schema.SchemaField{Name: "author", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "publish_date", Type: schema.FieldTypeDate},
			&schema.SchemaField{Name: "tags", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "status", Type: schema.FieldTypeText},
		)

		// [V1.40] NÂNG CẤP BẢNG USERS (Tự động thêm các trường thông tin cán bộ)
		usersColl, err := app.Dao().FindCollectionByNameOrId("users")
		if err == nil {
			userFields := []struct {
				Name string
				Type string
			}{
				{"phone", schema.FieldTypeText},
				{"position", schema.FieldTypeText},
				{"org", schema.FieldTypeText},
				{"address", schema.FieldTypeText},
				{"dob", schema.FieldTypeDate},
				{"bio", schema.FieldTypeText},
				{"id_number", schema.FieldTypeText},
				{"organization", schema.FieldTypeText},
				{"work_history_json", schema.FieldTypeText},
				{"allow_self_lookup", schema.FieldTypeBool},
				{"share_pin", schema.FieldTypeText},
				{"approved", schema.FieldTypeBool},
				{"role", schema.FieldTypeText},
			}

			modified := false
			for _, f := range userFields {
				if usersColl.Schema.GetFieldByName(f.Name) == nil {
					log.Printf("Go System: Thêm trường '%s' vào bảng users\n", f.Name)
					usersColl.Schema.AddField(&schema.SchemaField{
						Name: f.Name,
						Type: f.Type,
					})
					modified = true
				}
			}

			if modified {
				usersColl.ListRule = ptr("@request.auth.id != \"\"")
				usersColl.ViewRule = ptr("@request.auth.id != \"\"")
				usersColl.CreateRule = ptr("") // Cho phép mọi người đăng ký
				usersColl.UpdateRule = ptr("@request.auth.id != \"\"")
				if err := app.Dao().SaveCollection(usersColl); err != nil {
					log.Println("Go System Error: Không thể cập nhật bảng users:", err)
				}
			}
		}

		// KIỂM TRA VÀ TỰ ĐỘNG NÂNG CẤP BẢNG (Nếu đang dùng 'thumbnail' thì thêm 'image')
		if articlesColl.Schema.GetFieldByName("image") == nil {
			log.Println("Đang nâng cấp bảng articles: Thêm trường 'image'...")
			articlesColl.Schema.AddField(&schema.SchemaField{
				Name:    "image",
				Type:    schema.FieldTypeFile,
				Options: &schema.FileOptions{MaxSelect: 1, MaxSize: 5242880},
			})
		}
		if articlesColl.Schema.GetFieldByName("author") == nil {
			log.Println("Đang nâng cấp bảng articles: Thêm trường 'author'...")
			articlesColl.Schema.AddField(&schema.SchemaField{Name: "author", Type: schema.FieldTypeText})
		}
		if articlesColl.Schema.GetFieldByName("publish_date") == nil {
			log.Println("Đang nâng cấp bảng articles: Thêm trường 'publish_date'...")
			articlesColl.Schema.AddField(&schema.SchemaField{Name: "publish_date", Type: schema.FieldTypeDate})
		}
		if articlesColl.Schema.GetFieldByName("tags") == nil {
			log.Println("Đang nâng cấp bảng articles: Thêm trường 'tags'...")
			articlesColl.Schema.AddField(&schema.SchemaField{Name: "tags", Type: schema.FieldTypeText})
		}
		// Video field: dùng Text để lưu URL path (không giới hạn dung lượng)
		existingVideoField := articlesColl.Schema.GetFieldByName("video")
		if existingVideoField != nil && existingVideoField.Type == schema.FieldTypeFile {
			log.Println("Nâng cấp trường 'video' từ File → Text (không giới hạn dung lượng)...")
			articlesColl.Schema.RemoveField(existingVideoField.Id)
			articlesColl.Schema.AddField(&schema.SchemaField{Name: "video", Type: schema.FieldTypeText})
		} else if existingVideoField == nil {
			log.Println("Thêm trường 'video' (Text)...")
			articlesColl.Schema.AddField(&schema.SchemaField{Name: "video", Type: schema.FieldTypeText})
		}

		// Save if any fields were added
		if err := app.Dao().SaveCollection(articlesColl); err != nil {
			log.Println("Lỗi nâng cấp bảng articles:", err)
		}

		// === TẠO THƯ MỤC LƯU TRỮ VIDEO ===
		os.MkdirAll(filepath.Join("pb_data", "videos"), 0755)
		log.Println("Thư mục video: pb_data/videos/")

		// === CHUNKED VIDEO UPLOAD API (KHÔNG GIỚI HẠN DUNG LƯỢNG) ===

		// BƯỚC 1: Khởi tạo phiên upload
		e.Router.AddRoute(echo.Route{
			Method: http.MethodPost,
			Path:   "/api/video/start",
			Handler: func(c echo.Context) error {
				var data struct {
					Filename    string `json:"filename"`
					TotalSize   int64  `json:"total_size"`
					TotalChunks int    `json:"total_chunks"`
					ChunkSize   int64  `json:"chunk_size"`
				}
				if err := c.Bind(&data); err != nil {
					return c.JSON(400, map[string]string{"error": "Dữ liệu không hợp lệ"})
				}

				uploadId := fmt.Sprintf("vid_%d", time.Now().UnixNano())
				// Sanitize filename
				safeName := strings.ReplaceAll(data.Filename, "..", "")
				safeName = strings.ReplaceAll(safeName, "/", "_")
				safeName = strings.ReplaceAll(safeName, "\\", "_")
				if safeName == "" {
					safeName = fmt.Sprintf("video_%d.mp4", time.Now().Unix())
				}

				filePath := filepath.Join("pb_data", "videos", safeName)

				// Tạo file trống với kích thước đã biết (nếu có)
				f, err := os.Create(filePath)
				if err != nil {
					return c.JSON(500, map[string]string{"error": "Không thể tạo file"})
				}
				f.Close()

				session := &VideoUploadSession{
					Filename:    safeName,
					FilePath:    filePath,
					TotalSize:   data.TotalSize,
					ChunkSize:   data.ChunkSize,
					TotalChunks: data.TotalChunks,
					Written:     0,
					CreatedAt:   time.Now(),
				}

				videoSessionsMu.Lock()
				videoSessions[uploadId] = session
				videoSessionsMu.Unlock()

				log.Printf("[VideoUpload] Bắt đầu: ID=%s, File=%s, Size=%d bytes, Chunks=%d\n", uploadId, safeName, data.TotalSize, data.TotalChunks)

				return c.JSON(200, map[string]interface{}{
					"upload_id": uploadId,
					"filename":  safeName,
				})
			},
		})

		// BƯỚC 2: Nhận từng chunk (stream trực tiếp ra disk, không buffer trong RAM)
		e.Router.AddRoute(echo.Route{
			Method: http.MethodPost,
			Path:   "/api/video/chunk",
			Handler: func(c echo.Context) error {
				uploadId := c.Request().FormValue("upload_id")
				chunkIndexStr := c.Request().FormValue("chunk_index")

				videoSessionsMu.Lock()
				session, ok := videoSessions[uploadId]
				videoSessionsMu.Unlock()

				if !ok {
					return c.JSON(400, map[string]string{"error": "upload_id không hợp lệ"})
				}

				chunkIndex, _ := strconv.Atoi(chunkIndexStr)

				// Đọc chunk data từ multipart
				_, header, err := c.Request().FormFile("data")
				if err != nil {
					return c.JSON(400, map[string]string{"error": "Thiếu dữ liệu chunk"})
				}
				src, err := header.Open()
				if err != nil {
					return c.JSON(500, map[string]string{"error": "Không thể đọc chunk"})
				}
				defer src.Close()

				// Mở file để ghi tại offset chính xác
				f, err := os.OpenFile(session.FilePath, os.O_CREATE|os.O_WRONLY, 0644)
				if err != nil {
					return c.JSON(500, map[string]string{"error": "Không thể mở file"})
				}
				defer f.Close()

				offset := int64(chunkIndex) * session.ChunkSize
				f.Seek(offset, 0)

				written, err := io.Copy(f, src)
				if err != nil {
					return c.JSON(500, map[string]string{"error": "Ghi dữ liệu thất bại"})
				}

				session.Written += written

				log.Printf("[VideoUpload] Chunk %d/%d (%d bytes) → %s\n", chunkIndex+1, session.TotalChunks, written, session.Filename)

				return c.JSON(200, map[string]interface{}{
					"chunk_index":    chunkIndex,
					"written":        written,
					"total_received": session.Written,
				})
			},
		})

		// BƯỚC 3: Hoàn thành upload
		e.Router.AddRoute(echo.Route{
			Method: http.MethodPost,
			Path:   "/api/video/finish",
			Handler: func(c echo.Context) error {
				var data struct {
					UploadID string `json:"upload_id"`
				}
				if err := c.Bind(&data); err != nil {
					return c.JSON(400, map[string]string{"error": "Dữ liệu không hợp lệ"})
				}

				videoSessionsMu.Lock()
				session, ok := videoSessions[data.UploadID]
				if ok {
					delete(videoSessions, data.UploadID)
				}
				videoSessionsMu.Unlock()

				if !ok {
					return c.JSON(400, map[string]string{"error": "Phiên upload không tồn tại"})
				}

				// Kiểm tra file tồn tại
				info, err := os.Stat(session.FilePath)
				if err != nil {
					return c.JSON(500, map[string]string{"error": "File không tìm thấy"})
				}

				videoUrl := "/api/video/serve/" + session.Filename

				log.Printf("[VideoUpload] ✅ HOÀN THÀNH: %s (%d bytes)\n", session.Filename, info.Size())

				return c.JSON(200, map[string]interface{}{
					"video_url": videoUrl,
					"filename":  session.Filename,
					"size":      info.Size(),
				})
			},
		})

		// PHÁT VIDEO VỚI RANGE REQUEST (Dùng c.File để Echo tự xử lý tối ưu)
		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/video/serve/:filename",
			Handler: func(c echo.Context) error {
				filename := filepath.Base(c.PathParam("filename"))
				filePath := filepath.Join("pb_data", "videos", filename)

				if _, err := os.Stat(filePath); os.IsNotExist(err) {
					return c.JSON(404, map[string]string{"error": "Video không tìm thấy"})
				}

				// Tự động nhận diện MIME type dựa trên đuôi file
				ext := filepath.Ext(filename)
				contentType := "video/mp4" // Mặc định
				switch strings.ToLower(ext) {
				case ".webm":
					contentType = "video/webm"
				case ".ogg":
					contentType = "video/ogg"
				case ".mov":
					contentType = "video/quicktime"
				case ".hevc", ".h265":
					contentType = "video/hevc"
				}

				// Thiết lập Header tối ưu cho Media
				c.Response().Header().Set("Content-Type", contentType)
				c.Response().Header().Set("X-Content-Type-Options", "nosniff") // Quan trọng cho Media
				c.Response().Header().Set("Access-Control-Allow-Origin", "*")
				c.Response().Header().Set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
				c.Response().Header().Set("Accept-Ranges", "bytes")
				c.Response().Header().Set("Cache-Control", "public, max-age=86400")

				return c.File(filePath)
			},
		})

		// HEAD request cho video
		e.Router.AddRoute(echo.Route{
			Method: http.MethodHead,
			Path:   "/api/video/serve/:filename",
			Handler: func(c echo.Context) error {
				filename := filepath.Base(c.PathParam("filename"))
				filePath := filepath.Join("pb_data", "videos", filename)
				if _, err := os.Stat(filePath); os.IsNotExist(err) {
					return c.NoContent(404)
				}
				c.Response().Header().Set("Access-Control-Allow-Origin", "*")
				c.Response().Header().Set("Accept-Ranges", "bytes")
				return c.File(filePath)
			},
		})

		// Dọn dẹp phiên upload cũ (chạy mỗi giờ)
		go func() {
			for {
				time.Sleep(1 * time.Hour)
				videoSessionsMu.Lock()
				for id, s := range videoSessions {
					if time.Since(s.CreatedAt) > 24*time.Hour {
						log.Printf("[VideoUpload] Dọn phiên cũ: %s\n", id)
						os.Remove(s.FilePath)
						delete(videoSessions, id)
					}
				}
				videoSessionsMu.Unlock()
			}
		}()

		// Tạo bảng Trang (Missing in original)
		createCollection("pages",
			&schema.SchemaField{Name: "title", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "slug", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "content", Type: schema.FieldTypeEditor},
			&schema.SchemaField{Name: "menu", Type: schema.FieldTypeBool},
			&schema.SchemaField{Name: "order", Type: schema.FieldTypeNumber},
		)

		// Tạo bảng Cấu Hình
		settingsColl := createCollection("settings",
			&schema.SchemaField{Name: "key", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "value", Type: schema.FieldTypeEditor},
			&schema.SchemaField{Name: "group", Type: schema.FieldTypeText},
			// Các trường bổ sung cho Dashboard (nếu cần)
			&schema.SchemaField{Name: "website_title", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "org_name", Type: schema.FieldTypeText},
		)

		// TỰ ĐỘNG TẠO BẢN GHI SETTINGS 'general' NẾU CHƯA CÓ
		existing, _ := app.Dao().FindRecordById("settings", "general")
		if existing == nil {
			record := models.NewRecord(settingsColl)
			record.SetId("general") // Cố định ID là general
			record.Set("key", "general")
			record.Set("website_title", "ĐỊA BÀN DÂN CƯ SỐ 21")
			record.Set("org_name", "PHƯỜNG ĐIỆN BIÊN")
			record.Set("value", "{}")
			if err := app.Dao().SaveRecord(record); err == nil {
				log.Println("Đã khởi tạo bản ghi 'general' trong settings.")
			}
		}

		// Tạo bảng Phản Hồi (Feedback)
		feedbackColl := createCollection("feedback",
			&schema.SchemaField{Name: "name", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "email", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "contact", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "content", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "status", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "response", Type: schema.FieldTypeText},
			&schema.SchemaField{Name: "citizen_reply", Type: schema.FieldTypeText},
		)

		// NÂNG CẤP BẢNG FEEDBACK NẾU THIẾU TRƯỜNG
		feedbackModified := false
		if feedbackColl.Schema.GetFieldByName("contact") == nil {
			feedbackColl.Schema.AddField(&schema.SchemaField{Name: "contact", Type: schema.FieldTypeText})
			feedbackModified = true
		}
		if feedbackColl.Schema.GetFieldByName("response") == nil {
			feedbackColl.Schema.AddField(&schema.SchemaField{Name: "response", Type: schema.FieldTypeText})
			feedbackModified = true
		}
		if feedbackColl.Schema.GetFieldByName("citizen_reply") == nil {
			feedbackColl.Schema.AddField(&schema.SchemaField{Name: "citizen_reply", Type: schema.FieldTypeText})
			feedbackModified = true
		}
		if feedbackModified {
			app.Dao().SaveCollection(feedbackColl)
			log.Println("Đã nâng cấp bảng feedback với các trường mới.")
		}

		// TỰ ĐỘNG DỌN DẸP: Xóa bảng members cũ (đã hợp nhất vào users)
		membersColl, _ := app.Dao().FindCollectionByNameOrId("members")
		if membersColl != nil {
			app.Dao().DeleteCollection(membersColl)
		}

		// Tạo bảng Thành Viên (Members) - ĐÃ HỢP NHẤT VÀO BẢNG USERS
		/*
			createCollection("members",
				...
			)
		*/

		// PHỤC VỤ FILE TĨNH (Cải tiến: Không hijack các route API của PocketBase)
		// Register a catch-all route for static files but skip if it matches /api or /_
		e.Router.GET("/*", func(c echo.Context) error {
			path := c.Request().URL.Path
			// Skip if it's an API call or Admin UI call
			if len(path) >= 5 && (path[:5] == "/api/" || path[:3] == "/_/") {
				return echo.ErrNotFound // Let PocketBase core handle it
			}

			// Try serving from pb_public
			return apis.StaticDirectoryHandler(os.DirFS("./pb_public"), false)(c)
		})

		// === MOBILE URL ROUTE: /mobile/<page> ===
		// Serves the same HTML but signals mobile mode via query param
		e.Router.GET("/mobile/*", func(c echo.Context) error {
			param := c.PathParam("*") // e.g. "index", "tin-tuc", "bai-viet"
			if param == "" {
				param = "index"
			}
			// Map page name -> file
			fileName := param
			if !strings.HasSuffix(fileName, ".html") {
				fileName = fileName + ".html"
			}
			filePath := filepath.Join("pb_public", fileName)
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				// Fallback to index
				filePath = filepath.Join("pb_public", "index.html")
			}
			// Forward any existing query params
			existingQuery := c.Request().URL.RawQuery
			if existingQuery != "" {
				existingQuery = "&" + existingQuery
			}
			return c.Redirect(302, "/"+fileName+"?mobile=1"+existingQuery)
		})

		// Phục vụ thêm đường dẫn /pb_public/ để tương thích ngược
		e.Router.GET("/pb_public/*", apis.StaticDirectoryHandler(os.DirFS("./pb_public"), true))

		return nil
	})

	// 2. DATABASE HOOKS: ĐỒNG BỘ DỮ LIỆU TỰ ĐỘNG
	// (Ví dụ: Khi collection users thay đổi, tự động cập nhật bên members)
	app.OnRecordAfterUpdateRequest("users").Add(func(e *core.RecordUpdateEvent) error {
		// Tương lai: Logic đồng bộ user -> members ở đây
		return nil
	})

	// === DỌN DẸP FILE RÁC TỰ ĐỘNG KHI KHỞI ĐỘNG ===
	junkFiles := []string{
		"Dang", "Dung", "He", "Kiem", "Neu",
		"fix_all.py", "fix_all_mojibake_final.py",
		"fix_mojibake_ultimate.py", "fix_mojibake_v2.py",
		"fix_mojibake_v3.py", "fix_mojibake_v4.py",
		"fix_broken_urls.py", "inspect_encoding.py",
		"Build_Go.bat", "START_TUNNEL.bat",
	}
	for _, f := range junkFiles {
		if err := os.Remove(f); err == nil {
			log.Printf("[Cleanup] Đã xóa file rác: %s\n", f)
		}
	}

	// === API: TRẠNG THÁI HỆ THỐNG ===
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		e.Router.AddRoute(echo.Route{
			Method: http.MethodGet,
			Path:   "/api/system/status",
			Handler: func(c echo.Context) error {
				// Thống kê số record trong các bảng chính
				counts := map[string]interface{}{}
				for _, cName := range []string{"articles", "users", "feedback", "settings", "pages", "media"} {
					result, err := app.Dao().FindRecordsByFilter(cName, "id != ''", "-created", 1, 0, nil)
					if err == nil {
						_ = result
						// Đếm tổng
						total, _ := app.Dao().FindRecordsByFilter(cName, "id != ''", "-created", 99999, 0, nil)
						counts[cName] = len(total)
					} else {
						counts[cName] = "N/A"
					}
				}
				return c.JSON(http.StatusOK, map[string]interface{}{
					"status":    "running",
					"version":   "v1.50",
					"system":    "ĐBDC Số 21 - Phường Ba Đình",
					"port":      8090,
					"pb_data":   "pb_data/",
					"pb_public": "pb_public/",
					"tables":    counts,
				})
			},
		})
		return nil
	})

	// Khởi động hệ thống
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
