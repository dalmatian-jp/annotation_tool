# ステージ1: ビルド環境
FROM node:18-alpine AS build

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# ソースコードをコピー
COPY . .

# アプリケーションをビルド
RUN npm run build

# ステージ2: 本番環境
FROM node:18-alpine

WORKDIR /app

# serveをグローバルにインストール
RUN npm install -g serve

# ビルドされた静的ファイルをコピー
COPY --from=build /app/build .

# 3000番ポートを公開
EXPOSE 3000

# serveを使って静的ファイルを提供
CMD ["serve", "-s", ".", "-l", "3000"]