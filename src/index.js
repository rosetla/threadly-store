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
                    ""
                );

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

            /*
             * Allow:
             *
             * images/product-1.jpg
             * /images/product-1.jpg
             * https://...
             */

            if (
                image.startsWith("/") ||
                image.startsWith("images/")
            ) {

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


        function isValidId(value) {

            return /^\d+$/.test(
                String(value)
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
           VARIANT VALIDATION
           ===================================================== */

        const ALLOWED_COLORS = {

            "Black": "#000000",

            "White": "#FFFFFF",

            "Navy": "#1E2A44",

            "Red": "#C62828",

            "Royal Blue": "#2563EB",

            "Sport Grey": "#9CA3AF",

            "Dark Heather": "#4B5563",

            "Forest Green": "#166534",

            "Maroon": "#7F1D1D",

            "Sand": "#D6C2A1",

            "Light Pink": "#F9A8D4",

            "Military Green": "#4D5D3C"

        };


        const ALLOWED_SIZES = [
            "S",
            "M",
            "L",
            "XL",
            "2XL"
        ];


        function validateVariant(
            variant
        ) {

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


            const size =
                normalizeString(
                    variant.size,
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


            if (
                !Object.prototype.hasOwnProperty.call(
                    ALLOWED_COLORS,
                    colorName
                )
            ) {

                return {
                    error:
                        "Invalid color."
                };

            }


            if (
                !ALLOWED_SIZES.includes(
                    size
                )
            ) {

                return {
                    error:
                        "Invalid size."
                };

            }


            if (
                !/^#[0-9A-Fa-f]{6}$/.test(
                    colorHex
                )
            ) {

                return {
                    error:
                        "Invalid color hex."
                };

            }


            if (
                !isValidImageUrl(
                    image
                )
            ) {

                return {
                    error:
                        "Invalid variant image URL."
                };

            }


            if (
                !isValidStatus(
                    status
                )
            ) {

                return {
                    error:
                        "Invalid variant status."
                };

            }


            return {

                value: {

                    color_name:
                        colorName,

                    color_hex:
                        colorHex,

                    size,

                    image,

                    printify_variant_id:
                        printifyVariantId,

                    status

                }

            };

        }


        /* =====================================================
           PUBLIC API
           ===================================================== */

        /*
         * GET /api/products
         *
         * Public active products.
         */

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


        /*
         * GET /api/products/:id
         */

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
           ADMIN PRODUCT ROUTES
           ===================================================== */

        /*
         * GET /api/admin/products
         */

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
                    "ADMIN GET PRODUCTS:",
                    error
                );

                return errorResponse(
                    "Failed to load admin products.",
                    500
                );

            }

        }


        /*
         * ADMIN PRODUCT :id
         */

        const adminProductMatch =
            pathname.match(
                /^\/api\/admin\/products\/(\d+)$/
            );


        /*
         * GET ADMIN PRODUCT
         */

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
                    "ADMIN GET PRODUCT:",
                    error
                );

                return errorResponse(
                    "Failed to load product.",
                    500
                );

            }

        }


        /*
         * CREATE PRODUCT
         */

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
                    "Image must be a valid local path, HTTP or HTTPS URL.",
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
                    "ADMIN CREATE PRODUCT:",
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
                    "Failed to create product.",
                    500
                );

            }

        }


        /*
         * UPDATE PRODUCT
         */

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
                    "Image must be a valid local path, HTTP or HTTPS URL.",
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


            try {

                const existing =
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


                if (!existing) {

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
                    "ADMIN UPDATE PRODUCT:",
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


        /*
         * DELETE PRODUCT
         *
         * Soft delete.
         */

        if (
            adminProductMatch &&
            method === "DELETE"
        ) {

            const productId =
                Number(
                    adminProductMatch[1]
                );


            try {

                const existing =
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


                if (!existing) {

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
                    "ADMIN DELETE PRODUCT:",
                    error
                );

                return errorResponse(
                    "Failed to delete product.",
                    500
                );

            }

        }


        /* =====================================================
           VARIANT ROUTES
           ===================================================== */

        /*
         * GET:
         *
         * /api/admin/products/:id/variants
         */

        const productVariantsMatch =
            pathname.match(
                /^\/api\/admin\/products\/(\d+)\/variants$/
            );


        if (
            productVariantsMatch &&
            method === "GET"
        ) {

            const productId =
                Number(
                    productVariantsMatch[1]
                );


            try {

                const product =
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


                if (!product) {

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                const result =
                    await env.DB
                        .prepare(`
                            SELECT
                                id,
                                product_id,
                                color_name,
                                color_hex,
                                image,
                                printify_variant_id,
                                status,
                                created_at,
                                size
                            FROM product_variants
                            WHERE product_id = ?
                            ORDER BY
                                color_name ASC,
                                CASE size
                                    WHEN 'S' THEN 1
                                    WHEN 'M' THEN 2
                                    WHEN 'L' THEN 3
                                    WHEN 'XL' THEN 4
                                    WHEN '2XL' THEN 5
                                    ELSE 99
                                END
                        `)
                        .bind(
                            productId
                        )
                        .all();


                return json({

                    success: true,

                    variants:
                        result.results || []

                });

            } catch (error) {

                console.error(
                    "GET VARIANTS:",
                    error
                );

                return errorResponse(
                    "Failed to load variants.",
                    500
                );

            }

        }


        /*
         * PUT:
         *
         * /api/admin/products/:id/variants
         *
         * Replace all variants for product.
         */

        if (
            productVariantsMatch &&
            method === "PUT"
        ) {

            const productId =
                Number(
                    productVariantsMatch[1]
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


            if (
                !Array.isArray(
                    body.variants
                )
            ) {

                return errorResponse(
                    "variants must be an array.",
                    400
                );

            }


            try {

                const product =
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


                if (!product) {

                    return errorResponse(
                        "Product not found.",
                        404
                    );

                }


                const normalizedVariants = [];


                for (
                    const rawVariant
                    of body.variants
                ) {

                    const validated =
                        validateVariant(
                            rawVariant
                        );


                    if (
                        validated.error
                    ) {

                        return errorResponse(
                            validated.error,
                            400
                        );

                    }


                    normalizedVariants.push(
                        validated.value
                    );

                }


                /*
                 * Remove duplicates in request.
                 */

                const uniqueMap =
                    new Map();


                for (
                    const variant
                    of normalizedVariants
                ) {

                    const key =
                        `${variant.color_name}::${variant.size}`;

                    uniqueMap.set(
                        key,
                        variant
                    );

                }


                /*
                 * Delete existing variants.
                 */

                await env.DB
                    .prepare(`
                        DELETE FROM product_variants
                        WHERE product_id = ?
                    `)
                    .bind(
                        productId
                    )
                    .run();


                /*
                 * Insert new variants.
                 */

                for (
                    const variant
                    of uniqueMap.values()
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

                            variant.color_hex,

                            variant.image || null,

                            variant.printify_variant_id || null,

                            variant.status,

                            variant.size

                        )
                        .run();

                }


                const result =
                    await env.DB
                        .prepare(`
                            SELECT
                                id,
                                product_id,
                                color_name,
                                color_hex,
                                image,
                                printify_variant_id,
                                status,
                                created_at,
                                size
                            FROM product_variants
                            WHERE product_id = ?
                            ORDER BY
                                color_name ASC,
                                id ASC
                        `)
                        .bind(
                            productId
                        )
                        .all();


                return json({

                    success: true,

                    message:
                        "Product variants saved successfully.",

                    variants:
                        result.results || []

                });


            } catch (error) {

                console.error(
                    "SAVE VARIANTS:",
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
                        "Duplicate color and size combination.",
                        409
                    );

                }


                return errorResponse(
                    "Failed to save variants.",
                    500
                );

            }

        }


        /*
         * ADMIN SINGLE VARIANT
         *
         * GET /api/admin/variants/:id
         */

        const adminVariantMatch =
            pathname.match(
                /^\/api\/admin\/variants\/(\d+)$/
            );


        if (
            adminVariantMatch &&
            method === "GET"
        ) {

            const variantId =
                Number(
                    adminVariantMatch[1]
                );


            try {

                const variant =
                    await env.DB
                        .prepare(`
                            SELECT
                                id,
                                product_id,
                                color_name,
                                color_hex,
                                image,
                                printify_variant_id,
                                status,
                                created_at,
                                size
                            FROM product_variants
                            WHERE id = ?
                        `)
                        .bind(
                            variantId
                        )
                        .first();


                if (!variant) {

                    return errorResponse(
                        "Variant not found.",
                        404
                    );

                }


                return json({

                    success: true,

                    variant

                });

            } catch (error) {

                console.error(
                    "GET VARIANT:",
                    error
                );

                return errorResponse(
                    "Failed to load variant.",
                    500
                );

            }

        }


        /*
         * UPDATE SINGLE VARIANT
         *
         * PUT /api/admin/variants/:id
         */

        if (
            adminVariantMatch &&
            method === "PUT"
        ) {

            const variantId =
                Number(
                    adminVariantMatch[1]
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


            const validated =
                validateVariant(
                    body
                );


            if (
                validated.error
            ) {

                return errorResponse(
                    validated.error,
                    400
                );

            }


            const variant =
                validated.value;


            try {

                const existing =
                    await env.DB
                        .prepare(`
                            SELECT
                                id,
                                product_id
                            FROM product_variants
                            WHERE id = ?
                        `)
                        .bind(
                            variantId
                        )
                        .first();


                if (!existing) {

                    return errorResponse(
                        "Variant not found.",
                        404
                    );

                }


                await env.DB
                    .prepare(`
                        UPDATE product_variants
                        SET
                            color_name = ?,
                            color_hex = ?,
                            image = ?,
                            printify_variant_id = ?,
                            status = ?,
                            size = ?
                        WHERE id = ?
                    `)
                    .bind(

                        variant.color_name,

                        variant.color_hex,

                        variant.image || null,

                        variant.printify_variant_id || null,

                        variant.status,

                        variant.size,

                        variantId

                    )
                    .run();


                const updated =
                    await env.DB
                        .prepare(`
                            SELECT
                                id,
                                product_id,
                                color_name,
                                color_hex,
                                image,
                                printify_variant_id,
                                status,
                                created_at,
                                size
                            FROM product_variants
                            WHERE id = ?
                        `)
                        .bind(
                            variantId
                        )
                        .first();


                return json({

                    success: true,

                    message:
                        "Variant updated successfully.",

                    variant:
                        updated

                });


            } catch (error) {

                console.error(
                    "UPDATE VARIANT:",
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
                        "This color and size combination already exists.",
                        409
                    );

                }


                return errorResponse(
                    "Failed to update variant.",
                    500
                );

            }

        }


        /*
         * DELETE SINGLE VARIANT
         *
         * DELETE /api/admin/variants/:id
         */

        if (
            adminVariantMatch &&
            method === "DELETE"
        ) {

            const variantId =
                Number(
                    adminVariantMatch[1]
                );


            try {

                const existing =
                    await env.DB
                        .prepare(`
                            SELECT id
                            FROM product_variants
                            WHERE id = ?
                        `)
                        .bind(
                            variantId
                        )
                        .first();


                if (!existing) {

                    return errorResponse(
                        "Variant not found.",
                        404
                    );

                }


                await env.DB
                    .prepare(`
                        DELETE FROM product_variants
                        WHERE id = ?
                    `)
                    .bind(
                        variantId
                    )
                    .run();


                return json({

                    success: true,

                    message:
                        "Variant deleted successfully.",

                    variant_id:
                        variantId

                });


            } catch (error) {

                console.error(
                    "DELETE VARIANT:",
                    error
                );

                return errorResponse(
                    "Failed to delete variant.",
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
                    "TEST DB:",
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
