# 閩南數位文物展示平台

以攝影測量（Photogrammetry）建置的閩南文物三維模型線上展廳。可在瀏覽器中自由旋轉、縮放，支援電腦、手機與平板。

## 目錄結構

```
site/
├─ index.html              # 展廳首頁（作品列表 + 展示者）
├─ work.html               # 單一作品頁（3D 檢視器 + 作品敘述）
├─ data/
│  └─ works.json           # ★ 所有作品與展示者的資料（要新增作品改這裡）
├─ models/
│  └─ wang-zhongxiao.glb   # 壓縮後的 3D 模型（GLB + Draco，29MB）
├─ images/                 # 作品縮圖
└─ assets/
   ├─ css/style.css
   └─ js/
      ├─ app.js            # 首頁渲染
      └─ viewer.js         # three.js 3D 檢視器
```

## 如何新增一件作品

1. 把模型轉成 `.glb` 放進 `models/`（轉檔見下方）。
2. 縮圖放進 `images/`（建議 4:3，如 800×600 JPG）。
3. 編輯 `data/works.json`，在 `works` 陣列加一筆：

```json
{
  "id": "your-work-id",
  "title": "作品名稱",
  "subtitle": "English Subtitle",
  "uploaderId": "sheng",
  "model": "models/your-work-id.glb",
  "thumbnail": "images/your-work-id.jpg",
  "date": "2026-01-01",
  "location": "地點",
  "tags": ["標籤1", "標籤2"],
  "method": "建置方式",
  "description": "作品詳細敘述…",
  "credits": "資料來源／版權說明"
}
```

要新增「展示者（上傳者）」就在 `uploaders` 陣列加一筆，並讓作品的 `uploaderId` 指到它。

## 把 OBJ / 攝影測量模型轉成網頁用的壓縮 GLB

需安裝 Node.js。在 `tools/` 已有 `convert.sh`：

```bash
cd tools
npm install                 # 第一次才需要（obj2gltf、@gltf-transform/cli）
bash convert.sh             # OBJ tiles → 合併 → 合併場景 → Draco 壓縮 → site/models/
```

- 幾何用 Draco 14-bit 量化壓縮（肉眼幾乎無損），貼圖維持原解析度。
- 本次：228MB → 30MB（14 塊 tile 全部合併為一個完整模型）。
- ⚠️ 關鍵：`gltf-transform merge` 會把每塊 tile 各自保留成獨立 scene，而瀏覽器只載入「預設 scene」→ 只會顯示 1 塊。`tools/merge-scenes.mjs` 會把所有 scene 的節點併進同一個 scene，確保整個模型完整顯示。

### 調整模型方向與預設視角

在 `works.json` 每件作品可設：

- `"rotation": [x, y, z]` — 模型旋轉（度）。本件神像是「平躺著」被掃描的，需轉成端正坐姿，故用 `[0, 0, -110]`（含小角度滾轉修正掃描傾斜）。
- `"camera": [方位角, 仰角, 距離]` — 預設鏡頭位置（度／度／模型半徑倍數）。本件 `[90, 8, 2.7]` 為神像正面端坐視角。

模型為單面薄殼時，viewer 會自動以雙面渲染，避免看穿產生破洞感。

## 本機預覽

```bash
cd site
python3 -m http.server 8765
# 瀏覽器開 http://localhost:8765
```

（直接用 file:// 開會因瀏覽器安全限制無法載入 JSON／模型，務必用伺服器。）

## 部署到免費託管

整個 `site/` 資料夾就是靜態網站，可直接上傳：

- **GitHub Pages**：把 `site/` 內容推到 repo，Settings → Pages 指定分支即可。
- **Netlify / Cloudflare Pages**：拖曳 `site/` 資料夾上傳，或連結 Git repo，發佈目錄設為 `site`。

> 注意：免費託管常有單檔上限（GitHub 建議單檔 < 100MB），目前模型 29MB 無虞。日後若加入更大的模型，建議再壓縮貼圖或拆分。
