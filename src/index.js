export default {

    async fetch(request, env) {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;


        /* ==========================================
           API: GET ALL PRODUCTS
           ========================================== */

        if (
            pathname === "/api/products"
        ) {

            try {

                const result =
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
                            WHERE status = 'active'
                            ORDER BY id DESC
                        `)
                        .all();


                return Response.json({

                    success: true,

                    products:
                        result.results

                });

            } catch (error) {

                return Response.json({

                    success: false,

                    error:
                        error.message

                }, {

                    status: 500

                });

            }

        }



        /* ==========================================
           API: GET SINGLE PRODUCT
           Example:
           /api/products/1
           ========================================== */

        const productMatch =
            pathname.match(
                /^\/api\/products\/(\d+)$/
            );


        if (productMatch) {

            const productId =
                Number(
                    productMatch[1]
                );


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
                        .bind(
                            productId
                        )
                        .first();


                if (!product) {

                    return Response.json({

                        success: false,

                        error:
                            "Product not found"

                    }, {

                        status: 404

                    });

                }


                return Response.json({

                    success: true,

                    product:
                        product

                });

            } catch (error) {

                return Response.json({

                    success: false,

                    error:
                        error.message

                }, {

                    status: 500

                });

            }

        }



        /* ==========================================
           API: TEST DATABASE
           ========================================== */

        if (
            pathname === "/api/test-db"
        ) {

            try {

                const result =
                    await env.DB
                        .prepare(
                            "SELECT 1 AS ok"
                        )
                        .first();


                return Response.json({

                    success: true,

                    message:
                        "D1 OK",

                    database:
                        "threadly-db",

                    result

                });

            } catch (error) {

                return Response.json({

                    success: false,

                    error:
                        error.message

                }, {

                    status: 500

                });

            }

        }



        /* ==========================================
           STATIC ASSETS
           ========================================== */

        return env.ASSETS.fetch(
            request
        );

    }

};
