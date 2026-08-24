export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Test D1
    if (url.pathname === "/api/test-db") {
      try {
        const result = await env.DB
          .prepare("SELECT 1 AS ok")
          .first();

        return Response.json({
          success: true,
          message: "D1 OK",
          database: "threadly-db",
          result
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    // Get products
    if (url.pathname === "/api/products") {
      try {
        const { results } = await env.DB
          .prepare(`
            SELECT
              id,
              name,
              slug,
              description,
              price,
              image,
              category,
              printify_product_id,
              status,
              created_at
            FROM products
            WHERE status = 'active'
            ORDER BY id DESC
          `)
          .all();

        return Response.json({
          success: true,
          products: results
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    // Serve website
    return env.ASSETS.fetch(request);
  }
};
