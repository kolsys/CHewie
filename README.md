# CH-UI v1 Multihost 🚀

[![Version](https://img.shields.io/github/v/release/kolsys/ch-ui-v1-multihost?label=version&style=flat-square)](https://github.com/kolsys/ch-ui-v1-multihost/releases)

> **This is a fork of [CH-UI](https://github.com/caioricciuti/ch-ui) v1.9.0** — the last release of the v1 line — created by [Caio Ricciuti](https://github.com/caioricciuti). The fork extends the original with **multi-host support** (multiple saved connections with environment labels) and **custom connection parameters**. See [What This Fork Adds](#-what-this-fork-adds). All credit for the original project goes to its author.

A modern, feature-rich web interface for ClickHouse databases. CH-UI provides an intuitive platform for managing ClickHouse databases, executing queries, and visualizing metrics about your instance.

## ✨ What This Fork Adds

- **🖧 Multi-Host Connections**: Save multiple ClickHouse connections and switch between them on the fly — no more re-entering credentials when you work with several hosts.
- **🏷️ Environment Labels**: Tag each connection as `DEV`, `STAGING` or `PROD` and get a color-coded environment indicator in the UI, so you always know which host you are querying.
- **⚙️ Custom Connection Parameters**: Pass arbitrary ClickHouse settings per connection as a `key=value` list (e.g. `enable_analyzer=0&max_execution_time=300`) — applied to every query on that connection.
- **📦 Static Site Generator**: Build CH-UI as a set of static files (`npm run build:static`) ready for S3 or any static host — can be served straight from ClickHouse via `http_server_default_response`, no app server required. See [Static Build](#option-3-static-build-for-s3-or-any-static-host--clickhouse).
- **🗄️ Current Database Selection**: Double-click a database in the Explorer to make it the default for unqualified table names (`FROM my_table` instead of `FROM db.my_table`) — reflected in the editor and followed by autocomplete.
- **📤 Native ClickHouse Export Formats**: Export query results in any of ClickHouse's native output formats — CSV, TabSeparated, the JSON family, SQLInsert, Markdown, Avro, Parquet, and more — streamed directly from the server.
- **📜 Universal Logs Page**: Browse any `system.*_log` table available on the connected server (not just a fixed one), with curated views for the common ones and a generic viewer for the rest.
- **⚡ Responsive SQL Editor**: Debounced persistence keeps typing smooth even with large queries, with case-insensitive syntax highlighting and a comprehensive ClickHouse keyword list.
- **Σ `WITH TOTALS` Support**: Totals rows now render as a pinned, bold row at the bottom of the results grid and are included in CSV/JSON/clipboard exports.
- **📋 Clipboard-Friendly Results Grid**: Select a range of rows and copy — pasting into Google Sheets/Docs (or Excel) now lands in proper columns instead of a single cell, with reliable multi-row text selection on large result sets.
- **⌨️ Faster Table Navigation**: Cmd-click (macOS) / Ctrl-click (Windows/Linux) a table in the Explorer to jump straight into a `SELECT *` query tab, skipping the info page.

## 🌟 Key Features

### Core Functionality
- **🔄 ClickHouse Integration**: Seamless connection and interaction with ClickHouse databases
- **📝 Advanced SQL Editor**:
  - Intelligent IntelliSense with autocomplete suggestions
  - Syntax highlighting
  - Query history tracking
  - Multi-tab query execution
  - Query saving and management
- **📊 Dynamic Data Visualization**:
  - Interactive data tables with sorting and filtering
  - Support for column names with special characters (dots, spaces, etc.)
  - Custom visualization options
  - Real-time data updates

### Performance & Architecture
- **⚡ Optimized Performance**:
- LocalStorage-based lightweight persistence
  - Efficient state management
  - Responsive UI even with large datasets
- **🔒 TypeScript Implementation**: Full TypeScript support for improved code quality and developer experience
- **📦 Custom Table Management**: Built-in table handling without third-party dependencies

### Monitoring & Analytics
- **📈 Enhanced Metrics Dashboard**:
  - Query performance monitoring
  - Table statistics and insights
  - System settings overview
  - Network performance metrics
  - Resource utilization tracking

### Advanced Features
- **🌐 Distributed ClickHouse Support**:
  - ON CLUSTER operations for tables and users
  - Cluster-aware table creation
  - Distributed engine support
- **🔀 Reverse Proxy/Subpath Support**:
  - Deploy behind nginx/apache with custom base paths
  - Flexible URL routing
  - Production-ready proxy configurations
- **🔧 Runtime Configuration**:
  - Environment variables injected at Docker runtime
  - No rebuild required for configuration changes
  - Flexible deployment options

### User Experience
- **🎨 Modern UI/UX**:
  - Clean, intuitive interface
  - Responsive design
  - Dark/Light mode support
  - Customizable layouts

## 📸 Screenshots

<div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
  <img src="./docs/public/screenshots/screenshot1.png" alt="Main Dashboard" width="24%" />
  <img src="./docs/public/screenshots/screenshot2.png" alt="Query Interface" width="24%" />
  <img src="./docs/public/screenshots/screenshot8.png" alt="Instance Metrics" width="24%" />
  <img src="./docs/public/screenshots/screenshot9.png" alt="Query Metrics" width="24%" />
</div>

## 🚀 Getting Started

### Option 1: Docker (Recommended)

#### Simple Start
```bash
docker run --name ch-ui -p 5521:5521 ghcr.io/kolsys/ch-ui-v1-multihost:latest
```

#### Using Docker Compose
Create a `docker-compose.yml`:
```yaml
services:
  ch-ui:
    image: ghcr.io/kolsys/ch-ui-v1-multihost:latest
    restart: always
    ports:
      - "5521:5521"
    environment:
      # Core ClickHouse Configuration
      VITE_CLICKHOUSE_URL: "http://your-clickhouse-server:8123"
      VITE_CLICKHOUSE_USER: "your-username"
      VITE_CLICKHOUSE_PASS: "your-password"
      VITE_CLICKHOUSE_DATABASE: "your-default-db"

      # Optional: Advanced Features
      VITE_CLICKHOUSE_USE_ADVANCED: "false"
      VITE_CLICKHOUSE_CUSTOM_PATH: ""
      VITE_CLICKHOUSE_REQUEST_TIMEOUT: "30000"

      # Optional: Reverse Proxy Support
      VITE_BASE_PATH: "/"
```

Then run:
```bash
docker-compose up -d
```

#### Environment Variables

| Variable | Description | Required | Default | Since |
|----------|-------------|----------|---------|-------|
| **Core Configuration** |
| VITE_CLICKHOUSE_URL | ClickHouse server URL | Yes | - | v1.0.0 |
| VITE_CLICKHOUSE_USER | ClickHouse username | Yes | - | v1.0.0 |
| VITE_CLICKHOUSE_PASS | ClickHouse password | No | "" | v1.0.0 |
| **Advanced Features** |
| VITE_CLICKHOUSE_USE_ADVANCED | Enable advanced ClickHouse features (e.g., custom settings, system tables access) | No | false | v1.4.0 |
| VITE_CLICKHOUSE_CUSTOM_PATH | Custom path for ClickHouse HTTP interface | No | - | v1.4.0 |
| VITE_CLICKHOUSE_REQUEST_TIMEOUT | Request timeout in milliseconds | No | 30000 | v1.4.0 |
| **Deployment Configuration** |
| VITE_BASE_PATH | Base path for reverse proxy deployment (e.g., "/ch-ui") | No | "/" | v1.5.30 |

#### Advanced Docker Configuration

##### Complete Example with All Options
```yaml
services:
  ch-ui:
    image: ghcr.io/kolsys/ch-ui-v1-multihost:latest
    restart: always
    ports:
      - "5521:5521"
    environment:
      # Core Configuration
      VITE_CLICKHOUSE_URL: "http://your-clickhouse-server:8123"
      VITE_CLICKHOUSE_USER: "your-username"
      VITE_CLICKHOUSE_PASS: "your-password"

      # Advanced Options
      VITE_CLICKHOUSE_USE_ADVANCED: "true"  # Enable advanced features
      VITE_CLICKHOUSE_CUSTOM_PATH: "/custom/path"  # Custom HTTP path
      VITE_CLICKHOUSE_REQUEST_TIMEOUT: "60000"  # 60 second timeout

      # Deployment Options
      VITE_BASE_PATH: "/ch-ui"  # Deploy at https://yourdomain.com/ch-ui
```

##### Docker Run with All Options
```bash
docker run --name ch-ui -p 5521:5521 \
  -e VITE_CLICKHOUSE_URL=http://your-clickhouse-server:8123 \
  -e VITE_CLICKHOUSE_USER=your-username \
  -e VITE_CLICKHOUSE_PASS=your-password \
  -e VITE_CLICKHOUSE_DATABASE=your-database \
  -e VITE_CLICKHOUSE_USE_ADVANCED=true \
  -e VITE_CLICKHOUSE_CUSTOM_PATH=/custom/path \
  -e VITE_CLICKHOUSE_REQUEST_TIMEOUT=60000 \
  -e VITE_BASE_PATH=/ch-ui \
  ghcr.io/kolsys/ch-ui-v1-multihost:latest
```

### Option 2: Build from Source

#### Prerequisites
- Node.js >= 20.x
- npm >= 10.x

#### Installation Steps
```bash
# Clone the repository
git clone https://github.com/kolsys/ch-ui-v1-multihost.git

# Navigate to project directory
cd ch-ui-v1-multihost

# Install dependencies
npm install

# Build the project
npm run build

# Start for development
npm run dev

# Start for production
npm run preview
```

### Option 3: Static Build for S3 (or any static host) + ClickHouse

CH-UI is a pure client-side SPA — it can be built as static files, hosted on S3 (or GCS, Cloudflare R2, Yandex Object Storage, etc.), and served through ClickHouse itself via its `http_server_default_response` config option. This means visiting your ClickHouse HTTP interface root (e.g. `http://your-clickhouse-host:8123/`) returns the CH-UI shell, which then loads its JS/CSS from your static host — no separate app server needed.

The `npm run build:static` script automates both steps:

```bash
npm install

npm run build:static -- --base-url=https://your-bucket.example/ch-ui/
# or
S3_BASE_URL=https://your-bucket.example/ch-ui/ npm run build:static
```

This will:
1. Run `vite build` with the given URL baked in as the base for every asset reference (JS, CSS, favicon).
2. Write `dist/clickhouse-http-default-response.xml` — a ready-to-use ClickHouse config snippet wrapping the built `index.html` in a `<![CDATA[...]]>` block, and print the exact next steps in the console.

Then:

```bash
# 1. Upload everything except index.html and the generated xml to your bucket
aws s3 sync dist/ s3://your-bucket/ch-ui/ \
  --exclude "index.html" --exclude "clickhouse-http-default-response.xml"

# 2. Drop the generated snippet into ClickHouse's config.d/
cp dist/clickhouse-http-default-response.xml /etc/clickhouse-server/config.d/ch-ui-static.xml

# 3. Reload/restart ClickHouse
sudo systemctl restart clickhouse-server
```

The generated `dist/clickhouse-http-default-response.xml` looks like this:

```xml
<clickhouse>
    <http_server_default_response><![CDATA[<!doctype html>...<script src="https://your-bucket.example/ch-ui/assets/index-XXXXX.js"></script>...]]></http_server_default_response>
</clickhouse>
```

Notes:
- `--base-url`/`S3_BASE_URL` is required and must be an absolute `http(s)://` URL — there's no default bucket baked into the repo.
- No ClickHouse connection credentials are baked into this build; connect via the in-app setup wizard after loading the page (same as any other deployment).
- Options: `--out-dir` (default `dist`), `--config-out` (default `<out-dir>/clickhouse-http-default-response.xml`), `--skip-build` (regenerate the XML snippet from an already-built `dist/` without re-running Vite).

## 🧪 Development Environment

### Local ClickHouse Instance
For development purposes, you can run a local ClickHouse instance using Docker:

```bash
# Start ClickHouse
docker-compose -f docker-compose-dev.yml up -d

# Stop ClickHouse
docker-compose -f docker-compose-dev.yml down
```

Default credentials:
- URL: http://localhost:8123
- Username: dev
- Password: dev

Data is persisted in `.clickhouse_local_data` directory.

## 🔒 Security & Production Deployment

### Reverse Proxy Setup with Nginx

When deploying CH-UI behind a reverse proxy with a custom base path:

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # CH-UI with custom base path
    location /ch-ui/ {
        proxy_pass http://localhost:5521/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for real-time features
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### Docker Compose for Reverse Proxy
```yaml
services:
  ch-ui:
    image: ghcr.io/kolsys/ch-ui-v1-multihost:latest
    restart: always
    ports:
      - "127.0.0.1:5521:5521"  # Only bind to localhost
    environment:
      VITE_CLICKHOUSE_URL: "http://your-clickhouse-server:8123"
      VITE_CLICKHOUSE_USER: "your-username"
      VITE_CLICKHOUSE_PASS: "your-password"
      VITE_BASE_PATH: "/ch-ui"  # Must match nginx location
```

### HTTPS with Let's Encrypt
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /ch-ui/ {
        proxy_pass http://localhost:5521/;
        # ... rest of proxy configuration
    }
}
```

### Authentication with Basic Auth
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /ch-ui/ {
        auth_basic "Restricted Access";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://localhost:5521/;
        # ... rest of proxy configuration
    }
}
```

## 🎯 Distributed ClickHouse Support

CH-UI now supports distributed ClickHouse deployments with cluster operations:

### Features
- **ON CLUSTER Support**: Create tables and users across entire clusters
- **Cluster-Aware Operations**: Automatic detection of distributed setups
- **Distributed Engine**: Support for Distributed table engine

### Configuration
In your Settings page, enable "Distributed Mode" and specify your cluster name. This will:
- Enable ON CLUSTER syntax for table creation
- Enable ON CLUSTER syntax for user management
- Show cluster-specific options in the UI

### Example: Creating a Distributed Table
1. Enable Distributed Mode in Settings
2. Create a table with "ON CLUSTER" option checked
3. Select "Distributed" as the table engine
4. CH-UI will generate the appropriate DDL with cluster syntax

## 🐛 Troubleshooting

### Common Issues

#### Environment Variables Not Working
If environment variables aren't being applied:
1. Ensure you're using the latest image: `docker pull ghcr.io/kolsys/ch-ui-v1-multihost:latest`
2. Check logs: `docker logs ch-ui`
3. Verify variables are set: The logs should show which variables are SET/NOT SET

#### Reverse Proxy Issues
If CH-UI doesn't work correctly behind a reverse proxy:
1. Ensure `VITE_BASE_PATH` matches your proxy location
2. Don't include trailing slashes in `VITE_BASE_PATH`
3. Check browser console for 404 errors on assets

#### Column Names with Special Characters
CH-UI now properly handles column names containing:
- Dots (e.g., `user.email`)
- Spaces (e.g., `User Name`)
- Special characters

No configuration needed - this works automatically.

## 📚 Documentation

Documentation for the base functionality lives in the [`docs/`](./docs) directory of this repository. The original project's website is at [ch-ui.com](https://ch-ui.com) (it now covers CH-UI V2, a separate product unrelated to this fork).


#### Recommended Actions
1. Pull the latest Docker image
2. Review new environment variables
3. Test distributed features if using ClickHouse clusters

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup
```bash
# Clone and install
git clone https://github.com/kolsys/ch-ui-v1-multihost.git
cd ch-ui-v1-multihost
bun install

# Run tests
bun run test

# Run linter
bun run lint

# Start development server
bun run dev
```

## ❤️ Sponsors

<div align="center">
  <a href="https://iberodata.es/?utm_source=ch-ui&utm_medium=github" target="_blank">
    <img src="https://iberodata.es/logo.png" alt="Iberodata" width="100"/>
  </a>

  <p><strong>Iberodata</strong> - Empowering businesses with data-driven solutions</p>
</div>

## ☕ Support the Original Author

This fork builds on the work of Caio Ricciuti. If you find CH-UI helpful, consider supporting the original project:

<div align="center">
  <a href="https://buymeacoffee.com/caioricciuti?utm_source=ch-ui&utm_medium=github">
    <img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=caioricciuti&button_colour=FF813F&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00" alt="Buy Me A Coffee" />
  </a>
</div>

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE.md) file for details. See [NOTICE](./NOTICE.md) for attribution.


Original CH-UI made with ❤️ by [Caio Ricciuti](https://github.com/caioricciuti). Multi-host fork maintained at [kolsys/ch-ui-v1-multihost](https://github.com/kolsys/ch-ui-v1-multihost).
