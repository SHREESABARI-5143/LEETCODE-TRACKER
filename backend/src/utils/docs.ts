export const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CodeTrack API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -y-scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; font-family: 'Inter', sans-serif; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      const spec = {
        openapi: "3.0.0",
        info: {
          title: "CodeTrack Analytics API",
          description: "REST API for CodeTrack - LeetCode Analytics & Student Performance Tracking Platform.",
          version: "1.0.0"
        },
        servers: [
          { url: "/api/v1", description: "V1 Base Path" }
        ],
        paths: {
          "/auth/login": {
            post: {
              summary: "Authenticate User",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["collegeEmail", "password"],
                      properties: {
                        collegeEmail: { type: "string", example: "admin@svec.edu.in" },
                        password: { type: "string", example: "Admin@123" }
                      }
                    }
                  }
                }
              },
              responses: {
                "200": { description: "Successful Auth. Returns access and refresh token." }
              }
            }
          },
          "/auth/me": {
            get: {
              summary: "Get Current Logged-in User Info",
              security: [{ bearerAuth: [] }],
              responses: {
                "200": { description: "Current user profile." }
              }
            }
          },
          "/students": {
            get: {
              summary: "List Students (with Filters)",
              security: [{ bearerAuth: [] }],
              parameters: [
                { name: "year", in: "query", schema: { type: "integer" } },
                { name: "section", in: "query", schema: { type: "string" } },
                { name: "search", in: "query", schema: { type: "string" } }
              ],
              responses: {
                "200": { description: "Paginated list of students." }
              }
            }
          },
          "/students/search": {
            get: {
              summary: "Global Quick Search",
              security: [{ bearerAuth: [] }],
              parameters: [
                { name: "q", in: "query", required: true, schema: { type: "string" } }
              ],
              responses: {
                "200": { description: "Filtered list of matching students." }
              }
            }
          },
          "/analytics/department": {
            get: {
              summary: "Get Full Department Analytics Summary",
              security: [{ bearerAuth: [] }],
              responses: {
                "200": { description: "Department performance counts." }
              }
            }
          },
          "/analysis/students": {
            post: {
              summary: "Trigger student analysis profile sync",
              security: [{ bearerAuth: [] }],
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        year: { type: "integer" },
                        section: { type: "string" }
                      }
                    }
                  }
                }
              },
              responses: {
                "200": { description: "Analysis job successfully started." }
              }
            }
          }
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT"
            }
          }
        }
      };

      const ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
      window.ui = ui;
    };
  </script>
</body>
</html>
`;
