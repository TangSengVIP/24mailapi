# Build stage
FROM node:20-alpine as build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

# Set environment variables for build
ARG VITE_API_URL=http://localhost:8000
ARG VITE_DEFAULT_DOMAIN=localhost
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEFAULT_DOMAIN=$VITE_DEFAULT_DOMAIN

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
