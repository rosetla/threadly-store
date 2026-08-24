export default {

    async fetch(request, env) {

        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;


        /* =====================================================
           HELPERS
           ===================================================== */

        function json(data, status = 200) {

            return Response.json(data, {

                status,

                headers: {
                    "Cache-Control": "no-store"
                }

            });

        }


        function errorResponse(message, status = 400) {

            return json({

                success: false,
                error: message

            }, status);

        }


        function normalizeString(value, maxLength = 10000) {

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

            return normalizeString(value, 200)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

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

                const parsed = new URL(image);

                return [

                    "http:",
                    "https:"

                ].includes(parsed.protocol);

            } catch {

                return false;

            }

        }


        function isValidId(value) {

            return /^\d+$/.test(String(value));

        }



        /* =====================================================
           ADMIN AUTHENTICATION
           ===================================================== */

        function isAdminAuthenticated(request, env) {

            const authHeader =
                request.headers.get("Authorization");


            if (!authHeader) {

                return false;

            }


            if (
                !authHeader.startsWith("Bearer ")
            ) {

                return false;

            }


            const token =
                authHeader
                    .slice(7)
                    .trim();


            if (
                !token ||
                !env.ADMIN_TOKEN
            ) {

                return false;

            }


            return token === env.ADMIN_TOKEN;

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

        function normalizeVariantColor(value) {

            return normalizeString(
                value,
                100
            );

        }


        function normalizeVariantSize(value) {

            return normalizeString(
                value,
                30
            ).toUpperCase();

        }


        function isValidHex(value) {

            if (!value) {

                return true;

            }

            return /^#[0-9A-Fa-f]{6}$/.test(
                String(value)
            );

        }


        /* =====================================================
           NORMALIZE COLORS
           ===================================================== */

        function normalizeColors(colors) {

            if (!Array.isArray(colors)) {

                return [];

            }


            const result = [];
            const seen = new Set();


            for (const item of colors) {

                let name = "";
                let hex = "";
                let image = "";


                if (
                    typeof item === "string"
                ) {

                    name =
                        normalizeVariantColor(
                            item
                        );

                } else if (
                    item &&
                    typeof item === "object"
                ) {

                    name =
                        normalizeVariantColor(
                            item.name ||
                            item.color_name
                        );


                    hex =
                        normalizeString(
                            item.hex ||
                            item.color_hex,
                            20
                        );


                    image =
                        normalizeString(
                            item.image,
                            2000
                        );

                }


                if (!name) {

                    continue;

                }


                const key =
                    name.toLowerCase();


                if (seen.has(key)) {

                    continue;

                }


                seen.add(key);


                result.push({

                    name,
                    hex,
                    image

                });

            }


            return result;

        }



        /* =====================================================
           NORMALIZE SIZES
           ===================================================== */

        function normalizeSizes(sizes) {

            if (!Array.isArray(sizes)) {

                return [];

            }


            const result = [];
            const seen = new Set();


            for (const value of sizes) {

                const size =
                    normalizeVariantSize(
                        value
                    );


                if (!size) {

                    continue;

                }


                if (seen.has(size)) {

                    continue;

                }


                seen.add(size);


                result.push(size);

            }


            return result;

        }



        /* =====================================================
           GET PRODUCT VARIANTS
           ===================================================== */

        async function getProductVariants(
            productId,
            env
        ) {

            const result =
                await env.DB
                    .prepare(`
                        SELECT
                            id,
                            product_id,
                            color_name,
                            color_hex,
                            size,
                            image,
                            printify_variant_id,
                            status,
                            created_at
                        FROM product_variants
                        WHERE product_id = ?
                        AND status = 'active'
                        ORDER BY
                            color_name ASC,
                            CASE size
                                WHEN 'XS' THEN 1
                                WHEN 'S' THEN 2
                                WHEN 'M' THEN 3
                                WHEN 'L' THEN 4
                                WHEN 'XL' THEN 5
                                WHEN '2XL' THEN 6
                                WHEN '3XL' THEN 7
                                WHEN '4XL' THEN 8
                                WHEN '5XL' THEN 9
                                ELSE 99
                            END,
                            size ASC
                    `)
                    .bind(productId)
                    .all();


            return result.results || [];

        }



        /* =====================================================
           GET PRODUCT + VARIANTS
           ===================================================== */

        async function getProductWithVariants(
            productId,
            env
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
                await getProductVariants(
                    productId,
                    env
                );


            return product;

        }



        /* =====================================================
           PUBLIC API
           ===================================================== */


        /* =====================================================
           GET ALL ACTIVE PRODUCTS
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


                for (const product of products) {

                    product.variants =
                        await getProductVariants(
                            product.id,
                            env
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
           GET SINGLE PRODUCT
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
                Number(productMatch[1]);


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

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                product.variants =
                    await getProductVariants(
                        productId,
                        env
                    );


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

        if (
            pathname.startsWith("/api/admin/")
        ) {

            if (
                !isAdminAuthenticated(
                    request,
                    env
                )
            ) {

                return json({

                    success: false,
                    error: "Unauthorized."

                }, 401);

            }

        }



        /* =====================================================
           ADMIN PRODUCT ROUTE
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


                for (const product of products) {

                    product.variants =
                        await getProductVariants(
                            product.id,
                            env
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
                    await getProductWithVariants(
                        productId,
                        env
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


            const colors =
                normalizeColors(
                    body.colors
                );


            const sizes =
                normalizeSizes(
                    body.sizes
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


            if (!colors.length) {

                return errorResponse(
                    "Please select at least one color.",
                    400
                );

            }


            if (!sizes.length) {

                return errorResponse(
                    "Please select at least one size.",
                    400
                );

            }


            for (const color of colors) {

                if (
                    !isValidHex(
                        color.hex
                    )
                ) {

                    return errorResponse(
                        `Invalid color hex for "${color.name}".`,
                        400
                    );

                }


                if (
                    !isValidImageUrl(
                        color.image
                    )
                ) {

                    return errorResponse(
                        `Invalid image URL for "${color.name}".`,
                        400
                    );

                }

            }



            /* CREATE PRODUCT */

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


                /* CREATE COLOR × SIZE MATRIX */

                for (const color of colors) {

                    for (const size of sizes) {

                        await env.DB
                            .prepare(`
                                INSERT INTO product_variants (
                                    product_id,
                                    color_name,
                                    color_hex,
                                    size,
                                    image,
                                    printify_variant_id,
                                    status
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `)
                            .bind(

                                productId,

                                color.name,

                                color.hex ||
                                    null,

                                size,

                                color.image ||
                                    fields.image ||
                                    null,

                                null,

                                "active"

                            )
                            .run();

                    }

                }


                const product =
                    await getProductWithVariants(
                        productId,
                        env
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


                const message =
                    String(
                        error.message || ""
                    ).toLowerCase();


                if (
                    message.includes("unique")
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


            const colors =
                normalizeColors(
                    body.colors
                );


            const sizes =
                normalizeSizes(
                    body.sizes
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


            if (!colors.length) {

                return errorResponse(
                    "Please select at least one color.",
                    400
                );

            }


            if (!sizes.length) {

                return errorResponse(
                    "Please select at least one size.",
                    400
                );

            }


            for (const color of colors) {

                if (
                    !isValidHex(
                        color.hex
                    )
                ) {

                    return errorResponse(
                        `Invalid color hex for "${color.name}".`,
                        400
                    );

                }


                if (
                    !isValidImageUrl(
                        color.image
                    )
                ) {

                    return errorResponse(
                        `Invalid image URL for "${color.name}".`,
                        400
                    );

                }

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


                /* UPDATE PRODUCT */

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


                /* READ OLD VARIANTS */

                const oldVariants =
                    await getProductVariants(
                        productId,
                        env
                    );


                const oldMap =
                    new Map();


                for (
                    const variant of oldVariants
                ) {

                    const key =
                        `${variant.color_name.toLowerCase()}::${variant.size}`;


                    oldMap.set(
                        key,
                        variant
                    );

                }


                /* DELETE OLD VARIANTS */

                await env.DB
                    .prepare(`
                        DELETE FROM product_variants
                        WHERE product_id = ?
                    `)
                    .bind(productId)
                    .run();


                /* CREATE NEW MATRIX */

                for (const color of colors) {

                    for (const size of sizes) {

                        const key =
                            `${color.name.toLowerCase()}::${size}`;


                        const oldVariant =
                            oldMap.get(key);


                        await env.DB
                            .prepare(`
                                INSERT INTO product_variants (
                                    product_id,
                                    color_name,
                                    color_hex,
                                    size,
                                    image,
                                    printify_variant_id,
                                    status
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `)
                            .bind(

                                productId,

                                color.name,

                                color.hex ||
                                    null,

                                size,

                                color.image ||
                                    fields.image ||
                                    null,

                                oldVariant?.printify_variant_id ||
                                    null,

                                oldVariant?.status ||
                                    "active"

                            )
                            .run();

                    }

                }


                const product =
                    await getProductWithVariants(
                        productId,
                        env
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


                const message =
                    String(
                        error.message || ""
                    ).toLowerCase();


                if (
                    message.includes("unique")
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
           ADMIN VARIANT API
           ===================================================== */

        const adminVariantsMatch =
            pathname.match(
                /^\/api\/admin\/products\/(\d+)\/variants$/
            );



        /* =====================================================
           GET VARIANTS
           ===================================================== */

        if (
            adminVariantsMatch &&
            method === "GET"
        ) {

            const productId =
                Number(
                    adminVariantsMatch[1]
                );


            try {

                const product =
                    await env.DB
                        .prepare(`
                            SELECT id
                            FROM products
                            WHERE id = ?
                        `)
                        .bind(productId)
                        .first();


                if (!product) {

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                const variants =
                    await getProductVariants(
                        productId,
                        env
                    );


                return json({

                    success: true,
                    variants

                });


            } catch (error) {

                console.error(
                    "ADMIN GET VARIANTS error:",
                    error
                );


                return errorResponse(
                    "Failed to load variants.",
                    500
                );

            }

        }



        /* =====================================================
           UPDATE VARIANTS
           ===================================================== */

        if (
            adminVariantsMatch &&
            method === "PUT"
        ) {

            const productId =
                Number(
                    adminVariantsMatch[1]
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


            const colors =
                normalizeColors(
                    body.colors
                );


            const sizes =
                normalizeSizes(
                    body.sizes
                );


            if (!colors.length) {

                return errorResponse(
                    "Please select at least one color.",
                    400
                );

            }


            if (!sizes.length) {

                return errorResponse(
                    "Please select at least one size.",
                    400
                );

            }


            for (const color of colors) {

                if (
                    !isValidHex(
                        color.hex
                    )
                ) {

                    return errorResponse(
                        `Invalid color hex for "${color.name}".`,
                        400
                    );

                }


                if (
                    !isValidImageUrl(
                        color.image
                    )
                ) {

                    return errorResponse(
                        `Invalid image URL for "${color.name}".`,
                        400
                    );

                }

            }


            try {

                const product =
                    await env.DB
                        .prepare(`
                            SELECT
                                id,
                                image
                            FROM products
                            WHERE id = ?
                        `)
                        .bind(productId)
                        .first();


                if (!product) {

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                /* OLD VARIANTS */

                const oldVariants =
                    await getProductVariants(
                        productId,
                        env
                    );


                const oldMap =
                    new Map();


                for (
                    const variant of oldVariants
                ) {

                    const key =
                        `${variant.color_name.toLowerCase()}::${variant.size}`;


                    oldMap.set(
                        key,
                        variant
                    );

                }


                /* DELETE */

                await env.DB
                    .prepare(`
                        DELETE FROM product_variants
                        WHERE product_id = ?
                    `)
                    .bind(productId)
                    .run();


                /* CREATE NEW MATRIX */

                for (const color of colors) {

                    for (const size of sizes) {

                        const key =
                            `${color.name.toLowerCase()}::${size}`;


                        const oldVariant =
                            oldMap.get(key);


                        await env.DB
                            .prepare(`
                                INSERT INTO product_variants (
                                    product_id,
                                    color_name,
                                    color_hex,
                                    size,
                                    image,
                                    printify_variant_id,
                                    status
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `)
                            .bind(

                                productId,

                                color.name,

                                color.hex ||
                                    null,

                                size,

                                color.image ||
                                    product.image ||
                                    null,

                                oldVariant?.printify_variant_id ||
                                    null,

                                oldVariant?.status ||
                                    "active"

                            )
                            .run();

                    }

                }


                const variants =
                    await getProductVariants(
                        productId,
                        env
                    );


                return json({

                    success: true,

                    message:
                        "Variants updated successfully.",

                    variants

                });


            } catch (error) {

                console.error(
                    "ADMIN UPDATE VARIANTS error:",
                    error
                );


                return errorResponse(
                    "Failed to update variants.",
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
           STATIC FILES
           ===================================================== */

        return env.ASSETS.fetch(request);

    }

};
