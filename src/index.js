export default {

    async fetch(request, env) {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;

        const method =
            request.method;



        /* =====================================================
           HELPERS
           ===================================================== */

        function json(data, status = 200) {

            return Response.json(
                data,
                {
                    status,
                    headers: {
                        "Cache-Control": "no-store"
                    }
                }
            );

        }



        function errorResponse(
            message,
            status = 400
        ) {

            return json(
                {
                    success: false,
                    error: message
                },
                status
            );

        }



        function isValidId(value) {

            return /^\d+$/.test(
                String(value)
            );

        }



        function normalizeString(
            value,
            maxLength = 10000
        ) {

            if (
                value === null ||
                value === undefined
            ) {

                return "";

            }


            return String(value)
                .trim()
                .slice(0, maxLength);

        }



        function normalizeSlug(value) {

            return normalizeString(
                value,
                200
            )
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                );

        }



        function isValidStatus(status) {

            return [
                "active",
                "draft",
                "inactive"
            ].includes(
                status
            );

        }



        function isValidCategory(
            category
        ) {

            /*
             * Category is intentionally
             * kept flexible.
             *
             * Add/remove categories here
             * when the store grows.
             */

            return [
                "",
                "funny",
                "lifestyle",
                "trending",
                "music",
                "animals",
                "other"
            ].includes(
                category
            );

        }



        function isValidPrice(price) {

            if (
                typeof price !== "number" ||
                !Number.isFinite(price)
            ) {

                return false;

            }


            if (
                price < 0 ||
                price > 100000
            ) {

                return false;

            }


            return true;

        }



        function isValidImageUrl(
            image
        ) {

            if (!image) {

                return true;

            }


            try {

                const parsed =
                    new URL(image);


                return [
                    "http:",
                    "https:"
                ].includes(
                    parsed.protocol
                );

            } catch {

                return false;

            }

        }



        /* =====================================================
           PRODUCT FIELDS
           ===================================================== */

        function getProductFields(
            body
        ) {

            const name =
                normalizeString(
                    body.name,
                    200
                );


            const slug =
                normalizeSlug(
                    body.slug ||
                    body.name
                );


            const description =
                normalizeString(
                    body.description,
                    10000
                );


            const price =
                Number(
                    body.price
                );


            const image =
                normalizeString(
                    body.image,
                    2000
                );


            const category =
                normalizeString(
                    body.category,
                    100
                ).toLowerCase();


            const printifyProductId =
                normalizeString(
                    body.printify_product_id,
                    200
                );


            const status =
                normalizeString(
                    body.status,
                    30
                ).toLowerCase();


            return {

                name,

                slug,

                description,

                price,

                image,

                category,

                printify_product_id:
                    printifyProductId,

                status

            };

        }



        /* =====================================================
           PUBLIC API
           ===================================================== */


        /* =====================================================
           GET ALL ACTIVE PRODUCTS
           
           GET /api/products
           ===================================================== */

        if (
            pathname === "/api/products" &&
            method === "GET"
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


                return json({

                    success: true,

                    products:
                        result.results || []

                });

            } catch (error) {

                console.error(
                    "GET /api/products error:",
                    error
                );


                return errorResponse(
                    "Failed to load products.",
                    500
                );

            }

        }



        /* =====================================================
           GET SINGLE ACTIVE PRODUCT

           GET /api/products/:id
           ===================================================== */

        const productMatch =
            pathname.match(
                /^\/api\/products\/(\d+)$/
            );


        if (
            productMatch &&
            method === "GET"
        ) {

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

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                return json({

                    success: true,

                    product

                });

            } catch (error) {

                console.error(
                    "GET /api/products/:id error:",
                    error
                );


                return errorResponse(
                    "Failed to load product.",
                    500
                );

            }

        }



        /* =====================================================
           ADMIN API
           ===================================================== */


        /* =====================================================
           ADMIN: GET ALL PRODUCTS

           GET /api/admin/products
           
           IMPORTANT:
           This returns active, draft and inactive.
           ===================================================== */

        if (
            pathname === "/api/admin/products" &&
            method === "GET"
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
                            ORDER BY id DESC
                        `)
                        .all();


                return json({

                    success: true,

                    products:
                        result.results || []

                });

            } catch (error) {

                console.error(
                    "ADMIN GET PRODUCTS error:",
                    error
                );


                return errorResponse(
                    "Failed to load admin products.",
                    500
                );

            }

        }



        /* =====================================================
           ADMIN: GET SINGLE PRODUCT

           GET /api/admin/products/:id
           ===================================================== */

        const adminProductMatch =
            pathname.match(
                /^\/api\/admin\/products\/(\d+)$/
            );


        if (
            adminProductMatch &&
            method === "GET"
        ) {

            const productId =
                Number(
                    adminProductMatch[1]
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
                        `)
                        .bind(
                            productId
                        )
                        .first();


                if (!product) {

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                return json({

                    success: true,

                    product

                });

            } catch (error) {

                console.error(
                    "ADMIN GET PRODUCT error:",
                    error
                );


                return errorResponse(
                    "Failed to load product.",
                    500
                );

            }

        }



        /* =====================================================
           ADMIN: CREATE PRODUCT

           POST /api/admin/products
           ===================================================== */

        if (
            pathname === "/api/admin/products" &&
            method === "POST"
        ) {

            let body;


            try {

                body =
                    await request.json();

            } catch {

                return errorResponse(
                    "Invalid JSON body.",
                    400
                );

            }


            const fields =
                getProductFields(
                    body
                );



            /* ================================================
               VALIDATION
               ================================================ */

            if (!fields.name) {

                return errorResponse(
                    "Product name is required.",
                    400
                );

            }


            if (
                !fields.slug
            ) {

                return errorResponse(
                    "A valid slug is required.",
                    400
                );

            }


            if (
                !isValidPrice(
                    fields.price
                )
            ) {

                return errorResponse(
                    "Invalid product price.",
                    400
                );

            }


            if (
                !isValidImageUrl(
                    fields.image
                )
            ) {

                return errorResponse(
                    "Image must be a valid HTTP or HTTPS URL.",
                    400
                );

            }


            if (
                !isValidCategory(
                    fields.category
                )
            ) {

                return errorResponse(
                    "Invalid product category.",
                    400
                );

            }


            if (
                !isValidStatus(
                    fields.status
                )
            ) {

                return errorResponse(
                    "Invalid product status.",
                    400
                );

            }



            /* ================================================
               INSERT
               ================================================ */

            try {

                const result =
                    await env.DB
                        .prepare(`
                            INSERT INTO products (
                                name,
                                slug,
                                description,
                                price,
                                image,
                                category,
                                printify_product_id,
                                status
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `)
                        .bind(

                            fields.name,

                            fields.slug,

                            fields.description,

                            fields.price,

                            fields.image || null,

                            fields.category || null,

                            fields.printify_product_id || null,

                            fields.status

                        )
                        .run();


                const productId =
                    result.meta
                        ?.last_row_id;


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
                        `)
                        .bind(
                            productId
                        )
                        .first();


                return json({

                    success: true,

                    message:
                        "Product created successfully.",

                    product

                }, 201);

            } catch (error) {

                console.error(
                    "ADMIN CREATE PRODUCT error:",
                    error
                );


                /*
                 * SQLite UNIQUE constraint
                 * for slug.
                 */

                if (
                    String(
                        error.message
                    )
                    .toLowerCase()
                    .includes(
                        "unique"
                    )
                ) {

                    return errorResponse(
                        "A product with this slug already exists.",
                        409
                    );

                }


                return errorResponse(
                    "Failed to create product.",
                    500
                );

            }

        }



        /* =====================================================
           ADMIN: UPDATE PRODUCT

           PUT /api/admin/products/:id
           ===================================================== */

        if (
            adminProductMatch &&
            method === "PUT"
        ) {

            const productId =
                Number(
                    adminProductMatch[1]
                );


            let body;


            try {

                body =
                    await request.json();

            } catch {

                return errorResponse(
                    "Invalid JSON body.",
                    400
                );

            }


            const fields =
                getProductFields(
                    body
                );



            /* ================================================
               VALIDATION
               ================================================ */

            if (!fields.name) {

                return errorResponse(
                    "Product name is required.",
                    400
                );

            }


            if (!fields.slug) {

                return errorResponse(
                    "A valid slug is required.",
                    400
                );

            }


            if (
                !isValidPrice(
                    fields.price
                )
            ) {

                return errorResponse(
                    "Invalid product price.",
                    400
                );

            }


            if (
                !isValidImageUrl(
                    fields.image
                )
            ) {

                return errorResponse(
                    "Image must be a valid HTTP or HTTPS URL.",
                    400
                );

            }


            if (
                !isValidCategory(
                    fields.category
                )
            ) {

                return errorResponse(
                    "Invalid product category.",
                    400
                );

            }


            if (
                !isValidStatus(
                    fields.status
                )
            ) {

                return errorResponse(
                    "Invalid product status.",
                    400
                );

            }



            /* ================================================
               UPDATE
               ================================================ */

            try {

                const existingProduct =
                    await env.DB
                        .prepare(`
                            SELECT id
                            FROM products
                            WHERE id = ?
                        `)
                        .bind(
                            productId
                        )
                        .first();


                if (
                    !existingProduct
                ) {

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                await env.DB
                    .prepare(`
                        UPDATE products
                        SET
                            name = ?,
                            slug = ?,
                            description = ?,
                            price = ?,
                            image = ?,
                            category = ?,
                            printify_product_id = ?,
                            status = ?
                        WHERE id = ?
                    `)
                    .bind(

                        fields.name,

                        fields.slug,

                        fields.description,

                        fields.price,

                        fields.image || null,

                        fields.category || null,

                        fields.printify_product_id || null,

                        fields.status,

                        productId

                    )
                    .run();


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
                        `)
                        .bind(
                            productId
                        )
                        .first();


                return json({

                    success: true,

                    message:
                        "Product updated successfully.",

                    product

                });

            } catch (error) {

                console.error(
                    "ADMIN UPDATE PRODUCT error:",
                    error
                );


                if (
                    String(
                        error.message
                    )
                    .toLowerCase()
                    .includes(
                        "unique"
                    )
                ) {

                    return errorResponse(
                        "A product with this slug already exists.",
                        409
                    );

                }


                return errorResponse(
                    "Failed to update product.",
                    500
                );

            }

        }



        /* =====================================================
           ADMIN: DELETE PRODUCT

           DELETE /api/admin/products/:id

           SOFT DELETE:
           status = inactive

           We intentionally do NOT remove
           the database row.
           ===================================================== */

        if (
            adminProductMatch &&
            method === "DELETE"
        ) {

            const productId =
                Number(
                    adminProductMatch[1]
                );


            try {

                const existingProduct =
                    await env.DB
                        .prepare(`
                            SELECT id, status
                            FROM products
                            WHERE id = ?
                        `)
                        .bind(
                            productId
                        )
                        .first();


                if (
                    !existingProduct
                ) {

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                await env.DB
                    .prepare(`
                        UPDATE products
                        SET status = 'inactive'
                        WHERE id = ?
                    `)
                    .bind(
                        productId
                    )
                    .run();


                return json({

                    success: true,

                    message:
                        "Product moved to inactive status.",

                    product_id:
                        productId

                });

            } catch (error) {

                console.error(
                    "ADMIN DELETE PRODUCT error:",
                    error
                );


                return errorResponse(
                    "Failed to delete product.",
                    500
                );

            }

        }



        /* =====================================================
           API: TEST DATABASE

           GET /api/test-db
           ===================================================== */

        if (
            pathname === "/api/test-db" &&
            method === "GET"
        ) {

            try {

                const result =
                    await env.DB
                        .prepare(
                            "SELECT 1 AS ok"
                        )
                        .first();


                return json({

                    success: true,

                    message:
                        "D1 OK",

                    database:
                        "threadly-db",

                    result

                });

            } catch (error) {

                console.error(
                    "TEST DB error:",
                    error
                );


                return errorResponse(
                    "Database connection failed.",
                    500
                );

            }

        }



        /* =====================================================
           404 FOR UNKNOWN API ROUTES
           ===================================================== */

        if (
            pathname.startsWith(
                "/api/"
            )
        ) {

            return errorResponse(
                "API endpoint not found.",
                404
            );

        }



        /* =====================================================
           STATIC ASSETS
           ===================================================== */

        return env.ASSETS.fetch(
            request
        );

    }

};
