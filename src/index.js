export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /*
     * =========================================
     * API: GET ALL PRODUCTS
     *
     * /api/products
     * =========================================
     */

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

        return Response.json(
          {
            success: false,
            error: error.message
          },
          {
            status: 500
          }
        );

      }
    }


    /*
     * =========================================
     * API: GET ONE PRODUCT
     *
     * /api/product?id=1
     * =========================================
     */

    if (url.pathname === "/api/product") {

      const productId =
        url.searchParams.get("id");


      if (!productId) {

        return Response.json(
          {
            success: false,
            error: "Product ID is required"
          },
          {
            status: 400
          }
        );

      }


      try {

        const product =
          await env.DB
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
              WHERE id = ?
              AND status = 'active'
            `)
            .bind(productId)
            .first();


        if (!product) {

          return Response.json(
            {
              success: false,
              error: "Product not found"
            },
            {
              status: 404
            }
          );

        }


        return Response.json({
          success: true,
          product
        });

      } catch (error) {

        return Response.json(
          {
            success: false,
            error: error.message
          },
          {
            status: 500
          }
        );

      }

    }


    /*
     * =========================================
     * TEST DATABASE
     *
     * /api/test-db
     * =========================================
     */

    if (url.pathname === "/api/test-db") {

      try {

        const result =
          await env.DB
            .prepare(
              "SELECT 1 AS ok"
            )
            .first();


        return Response.json({
          success: true,
          message: "D1 OK",
          database: "threadly-db",
          result
        });

      } catch (error) {

        return Response.json(
          {
            success: false,
            error: error.message
          },
          {
            status: 500
          }
        );

      }

    }


    /*
     * =========================================
     * STATIC FILES
     * =========================================
     */

    return env.ASSETS.fetch(request);

  }
};
