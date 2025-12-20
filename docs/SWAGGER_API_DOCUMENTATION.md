# Swagger/OpenAPI API Documentation

## Overview

ScaleIT Bridge API is documented using OpenAPI 3.0.3 specification. The specification file is located at `swagger.yaml` in the project root.

## Viewing the Documentation

### Option 1: Swagger UI (Online)

1. Go to [Swagger Editor](https://editor.swagger.io/)
2. Click "File" → "Import file"
3. Select `swagger.yaml` from the project root
4. View interactive API documentation

### Option 2: Swagger UI (Local)

1. Install Swagger UI:
   ```bash
   npm install -g swagger-ui-serve
   ```

2. Serve the documentation:
   ```bash
   swagger-ui-serve swagger.yaml
   ```

3. Open browser: `http://localhost:3000`

### Option 3: Redoc

1. Install Redoc CLI:
   ```bash
   npm install -g redoc-cli
   ```

2. Generate HTML:
   ```bash
   redoc-cli bundle swagger.yaml -o api-docs.html
   ```

3. Open `api-docs.html` in browser

### Option 4: VS Code Extension

1. Install "OpenAPI (Swagger) Editor" extension in VS Code
2. Open `swagger.yaml`
3. Click "Preview" button to view documentation

## API Endpoints Summary

### Health & Status
- `GET /health` - Check service health

### Device Management
- `GET /devices` - List all devices
- `GET /api/config` - Get all device configurations
- `POST /api/config/save` - Save device configuration
- `DELETE /api/config/{device_id}` - Delete device configuration

### Scale Operations
- `POST /scalecmd` - Execute scale command (readGross, readNet, tare, zero)

### Server Control
- `POST /api/shutdown` - Gracefully shutdown server
- `POST /api/start` - Start server (if already running)

## Example Requests

### Check Health
```bash
curl http://localhost:8080/health
```

### List Devices
```bash
curl http://localhost:8080/devices
```

### Read Weight
```bash
curl -X POST http://localhost:8080/scalecmd \
  -H "Content-Type: application/json" \
  -d '{"device_id": "scale1", "command": "readGross"}'
```

### Save Device Configuration
```bash
curl -X POST http://localhost:8080/api/config/save \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "scale1",
    "config": {
      "name": "Main Scale",
      "manufacturer": "Dini Argeo",
      "model": "C320",
      "protocol": "ASCII",
      "connection": {
        "connection_type": "Tcp",
        "host": "192.168.1.254",
        "port": 4001
      },
      "timeout_ms": 5000,
      "commands": {
        "readGross": "READ",
        "readNet": "REXT",
        "tare": "TARE",
        "zero": "ZERO"
      },
      "enabled": true
    }
  }'
```

## Integration with Code Generators

### Generate TypeScript Client
```bash
npx @openapitools/openapi-generator-cli generate \
  -i swagger.yaml \
  -g typescript-axios \
  -o ./generated/typescript-client
```

### Generate Python Client
```bash
npx @openapitools/openapi-generator-cli generate \
  -i swagger.yaml \
  -g python \
  -o ./generated/python-client
```

### Generate Rust Client
```bash
npx @openapitools/openapi-generator-cli generate \
  -i swagger.yaml \
  -g rust \
  -o ./generated/rust-client
```

## Updating the Documentation

When adding new endpoints or modifying existing ones:

1. Update `swagger.yaml` with new endpoint definitions
2. Add request/response schemas to `components/schemas`
3. Add examples for better clarity
4. Update this README if needed
5. Commit and push changes

## Validation

Validate the OpenAPI specification:

```bash
# Using swagger-cli
npm install -g @apidevtools/swagger-cli
swagger-cli validate swagger.yaml

# Or using online validator
# https://editor.swagger.io/ - automatically validates on import
```

## Publishing

The Swagger documentation can be published to:

- **GitHub Pages**: Host the generated HTML
- **SwaggerHub**: Upload `swagger.yaml` to SwaggerHub
- **Read the Docs**: Include in project documentation
- **API Gateway**: Use for API gateway documentation

