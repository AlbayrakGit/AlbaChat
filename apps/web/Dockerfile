# Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Bağımlılıkları kopyala ve kur
COPY package.json ./
RUN npm install

# Kaynak kodunu kopyala ve inşa et
COPY . .
RUN npm run build

# Production Stage (Nginx)
FROM nginx:1.25-alpine

# Varsayılan konfigürasyonu temizle
RUN rm /etc/nginx/conf.d/default.conf

# Build sonucunu Nginx'e kopyala
COPY --from=build /app/dist /usr/share/nginx/html

# Özel Nginx konfigürasyonunu kopyala
COPY albachat.conf /etc/nginx/conf.d/albachat.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
