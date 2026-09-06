# Underdog Invest

个人投资组合跟踪：持仓、交易、收益与日历。默认把数据存在浏览器 `localStorage`；配置 Supabase 后可以可选地云同步，换设备或清理缓存也不会丢持仓。

线上：https://underdog-invest.vercel.app/

## 本地开发

```bash
npm install
npm run dev
```

本地默认仍是「仅本机」模式。Finnhub API Key 在设置页填写，只保存在当前浏览器，云同步不会上传它。

```bash
npm test
npm run build
```

## 可选：Supabase 云同步

未配置环境变量时，行为与现在完全一样（只写 `localStorage`）。配置后，设置页会出现登录 / 同步状态。

本项目是 **Vite**，浏览器里能读到的变量必须用 `VITE_` 前缀（不是 Next.js 的 `NEXT_PUBLIC_`）。

| 变量 | 说明 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL，例如 `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | 项目 Settings → API 里的 **anon public** key |

不要把 `service_role` key 写进前端或仓库。

### 1. 创建 Supabase 项目

1. 打开 [https://supabase.com/dashboard](https://supabase.com/dashboard) 并新建项目。
2. **Authentication → Providers**：启用 Email。个人使用建议在 **Authentication → Providers → Email** 关闭 *Confirm email*，这样注册后可立即登录。
3. **Authentication → URL Configuration**：
   - Site URL 填线上地址，例如 `https://underdog-invest.vercel.app`
   - Redirect URLs 加上该地址以及本地 `http://localhost:8080`

### 2. 运行 SQL（表 + RLS）

在 Supabase **SQL Editor** 中粘贴并执行 [`supabase/migrations/20260906120000_portfolios.sql`](supabase/migrations/20260906120000_portfolios.sql)。

这会创建 `public.portfolios`（每用户一行 JSON 快照，对应本机的 holdings / trades / returns / clearedHoldings / removedHoldings / priceHistory），并开启按 `auth.uid()` 隔离的 Row Level Security。匿名用户无法读写。

### 3. 本地环境变量

```bash
cp .env.example .env
```

填入项目 **Settings → API** 的 Project URL 和 `anon` `public` key，然后重启 `npm run dev`。

### 4. Vercel 部署

在 Vercel 项目 **Settings → Environment Variables** 添加同样的两个 `VITE_*` 变量，然后 **Redeploy**。Vite 只在构建时注入这些值，改完变量必须重新构建。

## 同步行为

- **未登录**：继续只使用本机 `localStorage`。
- **已登录**：登录后从云端拉取；之后的增删改会写入云端，本机存储当作缓存。
- **本机已有数据、云端为空**：会询问是否上传，不会默默清空。
- **本机和云端都有数据**：可选择使用云端、上传本机覆盖，或合并（按 id / 标的去重，冲突时保留本机）。
- 设置页可查看同步状态和上次同步时间，并手动「立即同步」。

清理浏览器缓存后，重新登录即可从云端恢复持仓。
