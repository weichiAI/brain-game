# Release Package

这个目录可直接作为部署包使用，不包含 `node_modules`。

## 首次部署

```bash
./init.sh
```

如需指定端口：

```bash
./init.sh 5011
```

初始化脚本会：

- 安装生产依赖（`npm install --omit=dev`）
- 创建运行时目录
- 写入 `.imagicma/runtime.env`

## 环境文件

发布目录会包含：

- 源项目根目录下的所有 `.env*` 文件，都会原封不动复制到发布目录

`npm start`（以及薄封装的 `./start.sh`）会按顺序自动加载：

1. `.env`
2. `.env.${NODE_ENV}`（如果设置了 `NODE_ENV`）
3. `.env.local`
4. `.env.${NODE_ENV}.local`（如果设置了 `NODE_ENV`）

如果你需要覆盖数据库、AI、支付、短信等配置，可以直接编辑发布目录里的对应 `.env*` 文件。

注意：既然是“原封不动复制”，如果源项目里的 `.env.local` 含有敏感信息，这些内容也会一起进入发布包。

## 启动

```bash
npm start
```

或：

```bash
./start.sh
```

## 使用 PM2

首次初始化后，可用 PM2 守护运行：

```bash
pm2 start npm --name web-app -- start
```

常用命令：

```bash
pm2 status
pm2 logs web-app
pm2 restart web-app
pm2 stop web-app
pm2 delete web-app
```

如需开机自启：

```bash
pm2 save
pm2 startup
```
