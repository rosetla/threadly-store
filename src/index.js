export default {

    async fetch(request, env) {

        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;


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
                    "");

        }


        function isValidStatus(status) {

            return [
                "active",
                "draft",
                "inactive"
            ].includes(status);

        }


        function isValidCategory(category) {

            return [
                "",
                "funny",
                "lifestyle",
                "trending",
                "music",
                "animals",
                "other"
            ].includes(category);

        }


        function isValidPrice(price) {

            return (
                typeof price === "number" &&
                Number.isFinite(price) &&
                price >= 0 &&
                price <= 100000
            );

        }


        function isValidImageUrl(image) {

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


        function isValidHexColor(hex) {

            if (!hex) {

                return true;

            }

            return /^#[0-9a-fA-F]{6}$/.test(
                hex
            );

        }


        /* =====================================================
           PRODUCT FIELDS
           ===================================================== */

        function getProductFields(body) {

            const name =
                normalizeString(
                    body.name,
                    200
                );


            const slug =
                normalizeSlug(
                    body.slug || body.name
                );


            const description =
                normalizeString(
                    body.description,
                    10000
                );


            const price =
                Number(body.price);


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
           VARIANT HELPERS
           ===================================================== */

        function normalizeVariants(
            variants
        ) {

            if (!Array.isArray(variants)) {

                return [];

            }


            return variants
                .map(function(variant) {

                    const colorName =
                        normalizeString(
                            variant.color_name,
                            100
                        );


                    const colorHex =
                        normalizeString(
                            variant.color_hex,
                            20
                        );


                    const image =
                        normalizeString(
                            variant.image,
                            2000
                        );


                    const printifyVariantId =
                        normalizeString(
                            variant.printify_variant_id,
                            200
                        );


                    const status =
                        normalizeString(
                            variant.status || "active",
                            30
                        ).toLowerCase();


                    const size =
                        normalizeString(
                            variant.size || "M",
                            20
                        ).toUpperCase();


                    return {

                        color_name:
                            colorName,

                        color_hex:
                            colorHex,

                        image,

                        printify_variant_id:
                            printifyVariantId,

                        status,

                        size

                    };

                })
                .filter(function(variant) {

                    return (
                        variant.color_name &&
                        variant.size
                    );

                });

        }


        function validateVariants(
            variants
        ) {

            const seen = new Set();


            for (
                const variant
                of variants
            ) {

                if (
                    !variant.color_name
                ) {

                    return "Variant color is required.";

                }


                if (
                    !variant.size
                ) {

                    return "Variant size is required.";

                }


                if (
                    !isValidHexColor(
                        variant.color_hex
                    )
                ) {

                    return (
                        "Invalid color hex for " +
                        variant.color_name +
                        "."
                    );

                }


                if (
                    !isValidImageUrl(
                        variant.image
                    )
                ) {

                    return (
                        "Variant image must be a valid HTTP or HTTPS URL."
                    );

                }


                if (
                    !isValidStatus(
                        variant.status
                    )
                ) {

                    return (
                        "Invalid variant status."
                    );

                }


                const key =
                    (
                        variant.color_name
                            .toLowerCase()
                            .trim()
                    ) +
                    "|" +
                    (
                        variant.size
                            .toUpperCase()
                            .trim()
                    );


                if (seen.has(key)) {

                    return (
                        "Duplicate variant: " +
                        variant.color_name +
                        " / " +
                        variant.size
                    );

                }


                seen.add(key);

            }


            return null;

        }


        /* =====================================================
           GET VARIANTS
           ===================================================== */

        async function getVariants(
            productId,
            includeInactive = true
        ) {

            let query = `

                SELECT

                    id,

                    product_id,

                    color_name,

                    color_hex,

                    image,

                    printify_variant_id,

                    status,

                    size,

                    created_at

                FROM product_variants

                WHERE product_id = ?

            `;


            if (!includeInactive) {

                query += `
                    AND status = 'active'
                `;

            }


            query += `

                ORDER BY
                    color_name ASC,
                    size ASC,
                    id ASC

            `;


            const result =
                await env.DB
                    .prepare(query)
                    .bind(productId)
                    .all();


            return result.results || [];

        }


        /* =====================================================
           REPLACE VARIANTS
           
           Product update will replace the complete
           variant list for that product.
           ===================================================== */

        async function replaceVariants(
            productId,
            variants
        ) {

            await env.DB
                .prepare(`
                    DELETE FROM product_variants
                    WHERE product_id = ?
                `)
                .bind(productId)
                .run();


            for (
                const variant
                of variants
            ) {

                await env.DB
                    .prepare(`

                        INSERT INTO product_variants (

                            product_id,

                            color_name,

                            color_hex,

                            image,

                            printify_variant_id,

                            status,

                            size

                        )

                        VALUES (?, ?, ?, ?, ?, ?, ?)

                    `)
                    .bind(

                        productId,

                        variant.color_name,

                        variant.color_hex || null,

                        variant.image || null,

                        variant.printify_variant_id || null,

                        variant.status,

                        variant.size

                    )
                    .run();

            }

        }


        /* =====================================================
           GET PRODUCT WITH VARIANTS
           ===================================================== */

        async function getProduct(
            productId,
            includeInactiveVariants = true
        ) {

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
                    .bind(productId)
                    .first();


            if (!product) {

                return null;

            }


            product.variants =
                await getVariants(
                    productId,
                    includeInactiveVariants
                );


            return product;

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


                const products =
                    result.results || [];


                for (
                    const product
                    of products
                ) {

                    product.variants =
                        await getVariants(
                            product.id,
                            false
                        );

                }


                return json({

                    success: true,

                    products

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
                    await getProduct(
                        productId,
                        false
                    );


                if (
                    !product ||
                    product.status !== "active"
                ) {

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
           ADMIN PRODUCT MATCH
           ===================================================== */

        const adminProductMatch =
            pathname.match(
                /^\/api\/admin\/products\/(\d+)$/
            );


        /* =====================================================
           ADMIN GET ALL PRODUCTS
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


                const products =
                    result.results || [];


                for (
                    const product
                    of products
                ) {

                    product.variants =
                        await getVariants(
                            product.id,
                            true
                        );

                }


                return json({

                    success: true,

                    products

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
           ADMIN GET SINGLE PRODUCT
           ===================================================== */

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
                    await getProduct(
                        productId,
                        true
                    );


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
           ADMIN CREATE PRODUCT
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
                getProductFields(body);


            const variants =
                normalizeVariants(
                    body.variants
                );


            /* VALIDATION */

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


            const variantError =
                validateVariants(
                    variants
                );


            if (variantError) {

                return errorResponse(
                    variantError,
                    400
                );

            }


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
                    result.meta?.last_row_id;


                await replaceVariants(
                    productId,
                    variants
                );


                const product =
                    await getProduct(
                        productId,
                        true
                    );


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


                if (
                    String(
                        error.message
                    )
                    .toLowerCase()
                    .includes("unique")
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
           ADMIN UPDATE PRODUCT
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
                getProductFields(body);


            const variants =
                normalizeVariants(
                    body.variants
                );


            /* VALIDATION */

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


            const variantError =
                validateVariants(
                    variants
                );


            if (variantError) {

                return errorResponse(
                    variantError,
                    400
                );

            }


            try {

                const existingProduct =
                    await env.DB
                        .prepare(`

                            SELECT id

                            FROM products

                            WHERE id = ?

                        `)
                        .bind(productId)
                        .first();


                if (!existingProduct) {

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


                await replaceVariants(
                    productId,
                    variants
                );


                const product =
                    await getProduct(
                        productId,
                        true
                    );


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
                    .includes("unique")
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
           ADMIN DELETE PRODUCT
           
           SOFT DELETE PRODUCT
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

                            SELECT id

                            FROM products

                            WHERE id = ?

                        `)
                        .bind(productId)
                        .first();


                if (!existingProduct) {

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
                    .bind(productId)
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
           TEST DATABASE
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

                    message: "D1 OK",

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
           UNKNOWN API
           ===================================================== */

        if (
            pathname.startsWith("/api/")
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
