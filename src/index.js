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
            PRINTIFY HELPERS
            ===================================================== */

            function colorMapHasName(
                colorMap,
                name
            ) {

                const target =
                    String(
                        name || ""
                    )
                    .trim()
                    .toLowerCase();


                for (
                    const color
                    of colorMap.values()
                ) {

                    if (
                        String(
                            color.name || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        target
                    ) {

                        return true;

                    }

                }


                return false;

            }



            function findColorHexByName(
                colorMap,
                name
            ) {

                const target =
                    String(
                        name || ""
                    )
                    .trim()
                    .toLowerCase();


                for (
                    const color
                    of colorMap.values()
                ) {

                    if (
                        String(
                            color.name || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        target
                    ) {

                        return color.hex ||
                            "#000000";

                    }

                }


                return "#000000";

            }



            function sizeMapHasName(
                sizeMap,
                name
            ) {

                const target =
                    String(
                        name || ""
                    )
                    .trim()
                    .toLowerCase();


                for (
                    const size
                    of sizeMap.values()
                ) {

                    if (
                        String(
                            size || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        target
                    ) {

                        return true;

                    }

                }


                return false;

            }

            function getPrintifyHeaders(env) {

                if (!env.PRINTIFY_API_TOKEN) {

                    throw new Error(
                        "PRINTIFY_API_TOKEN is not configured."
                    );

                }

                return {

                    "Authorization":
                        `Bearer ${env.PRINTIFY_API_TOKEN}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                };

            }



            async function printifyRequest(
                env,
                endpoint,
                options = {}
            ) {

                const response =
                    await fetch(
                        `https://api.printify.com/v1${endpoint}`,
                        {

                            method:
                                options.method || "GET",

                            headers:
                                getPrintifyHeaders(env),

                            body:
                                options.body
                                    ? JSON.stringify(
                                        options.body
                                    )
                                    : undefined

                        }
                    );


                const text =
                    await response.text();


                let data;


                try {

                    data =
                        text
                            ? JSON.parse(text)
                            : null;

                } catch {

                    data = {
                        raw: text
                    };

                }


                if (!response.ok) {

                    console.error(
                        "PRINTIFY API ERROR:",
                        response.status,
                        data
                    );


                    throw new Error(

                        `Printify API error ${response.status}: ` +
                        (
                            data?.message ||
                            data?.error ||
                            data?.raw ||
                            "Unknown error"
                        )

                    );

                }


                return data;

            }



            function createSlugFromTitle(title) {

                return String(title || "")

                    .normalize("NFKD")

                    .replace(
                        /[\u0300-\u036f]/g,
                        ""
                    )

                    .toLowerCase()

                    .replace(
                        /[^a-z0-9]+/g,
                        "-"
                    )

                    .replace(
                        /^-+|-+$/g,
                        ""
                    )

                    .slice(
                        0,
                        180
                    );

            }



            function getPrintifyVariantImage(
                product,
                variantId
            ) {

                if (
                    !Array.isArray(
                        product.images
                    )
                ) {

                    return null;

                }


                /*
                * Prefer a default image belonging
                * to this exact variant.
                */

                const exactDefault =
                    product.images.find(
                        image =>

                            Array.isArray(
                                image.variant_ids
                            ) &&

                            image.variant_ids.includes(
                                Number(variantId)
                            ) &&

                            image.is_default === true
                    );


                if (
                    exactDefault?.src
                ) {

                    return exactDefault.src;

                }



                /*
                * Otherwise use any image belonging
                * to this exact variant.
                */

                const exactImage =
                    product.images.find(
                        image =>

                            Array.isArray(
                                image.variant_ids
                            ) &&

                            image.variant_ids.includes(
                                Number(variantId)
                            ) &&

                            image.src
                    );


                if (
                    exactImage?.src
                ) {

                    return exactImage.src;

                }



                /*
                * Finally fall back to the first
                * available product image.
                */

                const fallback =
                    product.images.find(
                        image =>
                            image?.src
                    );


                return fallback?.src ||
                    null;

            }



            function getPrintifyOptionMaps(
                product
            ) {

                const colorMap =
                    new Map();

                const sizeMap =
                    new Map();


                const options =
                    Array.isArray(
                        product.options
                    )
                        ? product.options
                        : [];


                for (
                    const option
                    of options
                ) {

                    const type =
                        String(
                            option.type || ""
                        ).toLowerCase();


                    const values =
                        Array.isArray(
                            option.values
                        )
                            ? option.values
                            : [];


                    if (
                        type === "color" ||
                        type === "colour"
                    ) {

                        for (
                            const value
                            of values
                        ) {

                            colorMap.set(

                                Number(
                                    value.id
                                ),

                                {

                                    name:
                                        value.title,

                                    hex:
                                        Array.isArray(
                                            value.colors
                                        )
                                            ? (
                                                value.colors[0] ||
                                                "#000000"
                                            )
                                            : "#000000"

                                }

                            );

                        }

                    }


                    if (
                        type === "size"
                    ) {

                        for (
                            const value
                            of values
                        ) {

                            sizeMap.set(

                                Number(
                                    value.id
                                ),

                                value.title

                            );

                        }

                    }

                }


                return {

                    colorMap,

                    sizeMap

                };

            }

            async function createPrintifyOrder(
                env,
                orderData
            ) {

                const response =
                    await fetch(

                        `https://api.printify.com/v1/shops/${env.PRINTIFY_SHOP_ID}/orders.json`,

                        {

                            method:
                                "POST",

                            headers: {

                                "Authorization":
                                    `Bearer ${env.PRINTIFY_API_TOKEN}`,

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    orderData
                                )

                        }

                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    console.error(
                        "PRINTIFY CREATE ORDER ERROR:",
                        data
                    );


                    throw new Error(
                        data?.errors
                            ? JSON.stringify(
                                data.errors
                            )
                            : "Failed to create Printify order."
                    );

                }


                return data;

            }

            /* =====================================================
            PAYPAL HELPERS
            ===================================================== */

            function getPayPalBaseUrl(env) {

                if (
                    String(
                        env.PAYPAL_MODE || ""
                    ).toLowerCase() === "live"
                ) {

                    return "https://api-m.paypal.com";

                }


                return "https://api-m.sandbox.paypal.com";

            }



            async function getPayPalAccessToken(env) {

                if (
                    !env.PAYPAL_CLIENT_ID ||
                    !env.PAYPAL_CLIENT_SECRET
                ) {

                    throw new Error(
                        "PayPal credentials are not configured."
                    );

                }


                const credentials =
                    btoa(
                        `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
                    );


                const response =
                    await fetch(
                        getPayPalBaseUrl(env) +
                        "/v1/oauth2/token",
                        {
                            method: "POST",

                            headers: {

                                "Authorization":
                                    `Basic ${credentials}`,

                                "Content-Type":
                                    "application/x-www-form-urlencoded",

                                "Accept":
                                    "application/json"

                            },

                            body:
                                "grant_type=client_credentials"

                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.access_token
                ) {

                    console.error(
                        "PayPal token error:",
                        data
                    );


                    throw new Error(
                        "Unable to authenticate with PayPal."
                    );

                }


                return data.access_token;

            }



            async function createPayPalOrder(
                env,
                orderData
            ) {

                const accessToken =
                    await getPayPalAccessToken(
                        env
                    );


                const response =
                    await fetch(
                        getPayPalBaseUrl(env) +
                        "/v2/checkout/orders",
                        {
                            method: "POST",

                            headers: {

                                "Authorization":
                                    `Bearer ${accessToken}`,

                                "Content-Type":
                                    "application/json",

                                "Accept":
                                    "application/json",

                                "Prefer":
                                    "return=representation",

                                "PayPal-Request-Id":
                                    crypto.randomUUID()

                            },

                            body:
                                JSON.stringify(
                                    orderData
                                )

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    console.error(
                        "PayPal create order error:",
                        data
                    );


                    throw new Error(
                        data.message ||
                        "Unable to create PayPal order."
                    );

                }


                return data;

            }



            async function capturePayPalOrder(
                env,
                paypalOrderId
            ) {

                const accessToken =
                    await getPayPalAccessToken(
                        env
                    );


                const response =
                    await fetch(
                        getPayPalBaseUrl(env) +
                        "/v2/checkout/orders/" +
                        encodeURIComponent(
                            paypalOrderId
                        ) +
                        "/capture",
                        {
                            method: "POST",

                            headers: {

                                "Authorization":
                                    `Bearer ${accessToken}`,

                                "Content-Type":
                                    "application/json",

                                "Accept":
                                    "application/json",

                                "PayPal-Request-Id":
                                    crypto.randomUUID()

                            },

                            body:
                                "{}"

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    console.error(
                        "PayPal capture error:",
                        data
                    );


                    throw new Error(
                        data.message ||
                        "Unable to capture PayPal payment."
                    );

                }


                return data;

            }



            function createOrderNumber() {

                const timestamp =
                    Date.now()
                        .toString()
                        .slice(-10);


                const random =
                    crypto.randomUUID()
                        .replace(/-/g, "")
                        .slice(0, 6)
                        .toUpperCase();


                return (
                    "TC-" +
                    timestamp +
                    "-" +
                    random
                );

            }



            function formatUsd(amount) {

                return Number(amount)
                    .toFixed(2);

            }

            /* =====================================================
            ADMIN SESSION AUTHENTICATION
            ===================================================== */

            const ADMIN_SESSION_COOKIE =
                "threadly_admin_session";

            const SESSION_DURATION =
                24 * 60 * 60;


            function base64UrlEncode(data) {

                return btoa(
                    String.fromCharCode(
                        ...new Uint8Array(data)
                    )
                )
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=+$/, "");

            }


            function base64UrlDecode(value) {

                value = value
                    .replace(/-/g, "+")
                    .replace(/_/g, "/");

                while (value.length % 4) {
                    value += "=";
                }

                return Uint8Array.from(
                    atob(value),
                    c => c.charCodeAt(0)
                );

            }


            async function createAdminSession(env) {

                const payload = {

                    exp:
                        Math.floor(
                            Date.now() / 1000
                        ) + SESSION_DURATION

                };


                const payloadString =
                    JSON.stringify(payload);


                const encodedPayload =
                    base64UrlEncode(
                        new TextEncoder().encode(
                            payloadString
                        )
                    );


                const key =
                    await crypto.subtle.importKey(

                        "raw",

                        new TextEncoder().encode(
                            env.ADMIN_TOKEN
                        ),

                        {
                            name: "HMAC",
                            hash: "SHA-256"
                        },

                        false,

                        ["sign"]

                    );


                const signature =
                    await crypto.subtle.sign(

                        "HMAC",

                        key,

                        new TextEncoder().encode(
                            encodedPayload
                        )

                    );


                const encodedSignature =
                    base64UrlEncode(signature);


                return (
                    encodedPayload +
                    "." +
                    encodedSignature
                );

            }


            async function verifyAdminSession(
                request,
                env
            ) {

                const cookieHeader =
                    request.headers.get("Cookie");


                if (!cookieHeader) {
                    return false;
                }


                const cookies =
                    cookieHeader
                        .split(";")
                        .map(cookie =>
                            cookie.trim()
                        );


                const sessionCookie =
                    cookies.find(cookie =>
                        cookie.startsWith(
                            `${ADMIN_SESSION_COOKIE}=`
                        )
                    );


                if (!sessionCookie) {
                    return false;
                }


                const session =
                    sessionCookie.substring(
                        ADMIN_SESSION_COOKIE.length + 1
                    );


                const parts =
                    session.split(".");


                if (parts.length !== 2) {
                    return false;
                }


                const [
                    encodedPayload,
                    encodedSignature
                ] = parts;


                try {

                    const key =
                        await crypto.subtle.importKey(

                            "raw",

                            new TextEncoder().encode(
                                env.ADMIN_TOKEN
                            ),

                            {
                                name: "HMAC",
                                hash: "SHA-256"
                            },

                            false,

                            ["verify"]

                        );


                    const valid =
                        await crypto.subtle.verify(

                            "HMAC",

                            key,

                            base64UrlDecode(
                                encodedSignature
                            ),

                            new TextEncoder().encode(
                                encodedPayload
                            )

                        );


                    if (!valid) {
                        return false;
                    }


                    const payload =
                        JSON.parse(

                            new TextDecoder().decode(
                                base64UrlDecode(
                                    encodedPayload
                                )
                            )

                        );


                    if (
                        !payload.exp ||
                        payload.exp <
                        Math.floor(
                            Date.now() / 1000
                        )
                    ) {
                        return false;
                    }


                    return true;


                } catch {

                    return false;

                }

            }


            async function isAdminAuthenticated(
                request,
                env
            ) {

                /*
                * Bearer token support.
                *
                * This is useful for testing the API
                * directly with Postman / curl / DevTools.
                */

                const authHeader =
                    request.headers.get(
                        "Authorization"
                    );


                if (
                    authHeader &&
                    authHeader.startsWith(
                        "Bearer "
                    )
                ) {

                    const token =
                        authHeader
                            .slice(7)
                            .trim();


                    if (
                        token &&
                        env.ADMIN_TOKEN &&
                        token === env.ADMIN_TOKEN
                    ) {

                        return true;

                    }

                }


                /*
                * Normal website authentication.
                */

                return await verifyAdminSession(
                    request,
                    env
                );

            }



            /* =====================================================
            ADMIN LOGIN
            ===================================================== */

            if (
                pathname === "/api/admin/login" &&
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


                const password =
                    typeof body.password === "string"
                        ? body.password.trim()
                        : "";


                if (!password) {

                    return errorResponse(
                        "Password is required.",
                        400
                    );

                }


                if (
                    !env.ADMIN_TOKEN ||
                    password !== env.ADMIN_TOKEN
                ) {

                    return errorResponse(
                        "Invalid admin password.",
                        401
                    );

                }


                const session =
                    await createAdminSession(env);


                return new Response(

                    JSON.stringify({
                        success: true,
                        message: "Login successful."
                    }),

                    {
                        status: 200,

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Cache-Control":
                                "no-store",

                            "Set-Cookie":
                                `${ADMIN_SESSION_COOKIE}=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION}`

                        }

                    }

                );

            }



            /* =====================================================
            ADMIN LOGOUT
            ===================================================== */

            if (
                pathname === "/api/admin/logout" &&
                method === "POST"
            ) {

                return new Response(

                    JSON.stringify({
                        success: true,
                        message: "Logged out."
                    }),

                    {
                        status: 200,

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Cache-Control":
                                "no-store",

                            "Set-Cookie":
                                `${ADMIN_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

                        }

                    }

                );

            }


            /* =====================================================
            ADMIN SESSION CHECK
            ===================================================== */

            if (
                pathname === "/api/admin/me" &&
                method === "GET"
            ) {

                const authenticated =
                    await verifyAdminSession(
                        request,
                        env
                    );


                if (!authenticated) {

                    return json({
                        authenticated: false
                    }, 401);

                }


                return json({
                    authenticated: true
                });

            }

            /* =====================================================
            PRINTIFY PRODUCT SYNC
            ===================================================== */

            if (
                pathname.startsWith(
                    "/api/admin/printify/products/"
                ) &&
                pathname.endsWith("/sync") &&
                method === "POST"
            ) {

                const authenticated =
                    await isAdminAuthenticated(
                        request,
                        env
                    );



                if (!authenticated) {

                    return json({
                        success: false,
                        error: "Unauthorized."
                    }, 401);

                }



                try {

                    const pathParts =
                        pathname
                            .split("/")
                            .filter(Boolean);



                    /*
                    Example:

                    /api/admin/printify/products/ABC123/sync

                    [
                        "api",
                        "admin",
                        "printify",
                        "products",
                        "ABC123",
                        "sync"
                    ]
                    */

                    const productIndex =
                        pathParts.indexOf(
                            "products"
                        );



                    const printifyProductId =
                        pathParts[
                            productIndex + 1
                        ];



                    if (!printifyProductId) {

                        return json({
                            success: false,
                            error:
                                "Printify product ID is required."
                        }, 400);

                    }

                    /*
                    Get product from Printify
                    */

                    const printifyProduct =
                        await printifyRequest(

                            env,

                            "/shops/" +
                            encodeURIComponent(
                                env.PRINTIFY_SHOP_ID
                            ) +
                            "/products/" +
                            encodeURIComponent(
                                printifyProductId
                            ) +
                            ".json"

                        );

                    if (!printifyProduct) {

                        throw new Error(
                            "Printify product not found."
                        );

                    }

                    /*
                    Build option maps.

                    colorMap:
                    Printify color option ID
                    ->
                    {
                        name,
                        hex
                    }

                    sizeMap:
                    Printify size option ID
                    ->
                    size name
                    */

                    const {
                        colorMap,
                        sizeMap

                    } =
                        getPrintifyOptionMaps(
                            printifyProduct
                        );



                    /*
                    Product image
                    */

                    const mainImage =
                        Array.isArray(
                            printifyProduct.images
                        )
                            ? (
                                printifyProduct.images.find(
                                    image =>
                                        image?.is_default === true &&
                                        image?.src
                                )?.src ||

                                printifyProduct.images.find(
                                    image =>
                                        image?.src
                                )?.src ||

                                ""
                            )
                            : "";



                    /*
                    Generate slug
                    */

                    const slug =
                        createSlugFromTitle(
                            printifyProduct.title
                        );



                    /*
                    Default price.

                    Printify price is usually in cents.
                    */

                    let defaultPrice =
                        0;



                    if (
                        Array.isArray(
                            printifyProduct.variants
                        ) &&
                        printifyProduct.variants.length > 0
                    ) {

                        const firstActiveVariant =
                            printifyProduct.variants.find(
                                variant =>
                                    variant.is_enabled !== false
                            ) ||
                            printifyProduct.variants[0];



                        defaultPrice =
                            Number(
                                firstActiveVariant.price || 0
                            ) / 100;

                    }


                    /*
                    Check whether this Printify product
                    already exists in D1.
                    */

                    const existingProduct =
                        await env.DB
                            .prepare(`

                                SELECT
                                    id

                                FROM products

                                WHERE printify_product_id = ?

                                LIMIT 1

                            `)
                            .bind(
                                String(
                                    printifyProduct.id
                                )
                            )
                            .first();



                    let productId;



                    if (existingProduct) {

                        productId =
                            existingProduct.id;



                        /*
                        Update existing product
                        */

                        await env.DB
                            .prepare(`

                                UPDATE products

                                SET

                                    name = ?,

                                    slug = ?,

                                    description = ?,

                                    price = ?,

                                    image = ?,

                                    printify_product_id = ?,

                                    status = 'active'

                                WHERE id = ?

                            `)
                            .bind(

                                String(
                                    printifyProduct.title || ""
                                ),

                                slug,

                                String(
                                    printifyProduct.description || ""
                                ),

                                defaultPrice,

                                mainImage,

                                String(
                                    printifyProduct.id
                                ),

                                productId

                            )
                            .run();

                    } else {

                        /*
                        Create product
                        */

                        const result =
                            await env.DB
                                .prepare(`

                                    INSERT INTO products (

                                        name,

                                        slug,

                                        description,

                                        price,

                                        image,

                                        printify_product_id,

                                        status

                                    )

                                    VALUES (

                                        ?,

                                        ?,

                                        ?,

                                        ?,

                                        ?,

                                        ?,

                                        'active'

                                    )

                                `)
                                .bind(

                                    String(
                                        printifyProduct.title || ""
                                    ),

                                    slug,

                                    String(
                                        printifyProduct.description || ""
                                    ),

                                    defaultPrice,

                                    mainImage,

                                    String(
                                        printifyProduct.id
                                    )

                                )
                                .run();



                        productId =
                            result.meta.last_row_id;

                    }

                    /*
                    Remove old variants.

                    Since this is a sync operation,
                    we rebuild variants from Printify.
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



                    let syncedVariants = 0;

                    const syncedColors =
                        new Set();

                    const syncedSizes =
                        new Set();



                    const variants =
                        Array.isArray(
                            printifyProduct.variants
                        )
                            ? printifyProduct.variants
                            : [];



                    /*
                    Sync every enabled variant
                    */

                    for (
                        const variant
                        of variants
                    ) {

                        /*
                        Skip disabled variants
                        */

                        if (
                            variant.is_enabled === false
                        ) {

                            continue;

                        }



                        const optionIds =
                            Array.isArray(
                                variant.options
                            )
                                ? variant.options
                                : [];



                        let colorName = "";

                        let colorHex = "";

                        let size = "";



                        /*
                        Find color and size
                        from option IDs.
                        */

                        for (
                            const optionId
                            of optionIds
                        ) {

                            const numericOptionId =
                                Number(optionId);



                            if (
                                colorMap.has(
                                    numericOptionId
                                )
                            ) {

                                const color =
                                    colorMap.get(
                                        numericOptionId
                                    );



                                colorName =
                                    String(
                                        color?.name || ""
                                    );



                                colorHex =
                                    String(
                                        color?.hex ||
                                        "#000000"
                                    );

                            }



                            if (
                                sizeMap.has(
                                    numericOptionId
                                )
                            ) {

                                size =
                                    String(
                                        sizeMap.get(
                                            numericOptionId
                                        ) || ""
                                    );

                            }

                        }



                        /*
                        Ignore malformed variants.
                        */

                        if (
                            !colorName &&
                            !size
                        ) {

                            console.log(
                                "Skipping variant without color or size:",
                                variant
                            );

                            continue;

                        }



                        /*
                        Get image belonging to this variant
                        */

                        const variantImage =
                            getPrintifyVariantImage(

                                printifyProduct,

                                variant.id

                            ) ||
                            mainImage ||
                            "";



                        /*
                        Insert variant
                        */

                        await env.DB
                            .prepare(`

                                INSERT INTO product_variants (

                                    product_id,

                                    color_name,

                                    color_hex,

                                    size,

                                    image,

                                    printify_variant_id,

                                    status,

                                    created_at

                                )

                                VALUES (

                                    ?,

                                    ?,

                                    ?,

                                    ?,

                                    ?,

                                    ?,

                                    'active',

                                    CURRENT_TIMESTAMP

                                )

                            `)
                            .bind(

                                productId,

                                colorName || null,

                                colorHex || null,

                                size || null,

                                variantImage,

                                String(
                                    variant.id
                                )

                            )
                            .run();



                        syncedVariants++;



                        if (colorName) {

                            syncedColors.add(
                                colorName
                            );

                        }



                        if (size) {

                            syncedSizes.add(
                                size
                            );

                        }

                    }



                    /*
                    Return sync result
                    */

                    const product =
                        await env.DB
                            .prepare(`

                                SELECT *

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
                            "Printify product synced successfully.",

                        printify_product_id:
                            String(
                                printifyProduct.id
                            ),

                        product_id:
                            productId,

                        product,

                        sync: {

                            colors:
                                syncedColors.size,

                            sizes:
                                syncedSizes.size,

                            variants:
                                syncedVariants

                        }

                    });



                } catch (error) {

                    console.error(
                        "PRINTIFY PRODUCT SYNC ERROR:",
                        error
                    );



                    return json({

                        success: false,

                        error:
                            error?.message ||
                            "Failed to sync Printify product."

                    }, 500);

                }

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


                    for (
                        const product
                        of products
                    ) {

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
            ADMIN API AUTHENTICATION
            ===================================================== */

            if (
                pathname.startsWith(
                    "/api/admin/"
                )
            ) {

                if (
                    !(await isAdminAuthenticated(
                        request,
                        env
                    ))
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
                pathname ===
                    "/api/admin/products" &&
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
                pathname ===
                    "/api/admin/products" &&
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

                                VALUES (
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?
                                )

                            `)
                            .bind(

                                fields.name,

                                fields.slug,

                                fields.description,

                                fields.price,

                                fields.image ||
                                    null,

                                fields.category ||
                                    null,

                                fields.printify_product_id ||
                                    null,

                                fields.status

                            )
                            .run();


                    const productId =
                        result.meta?.last_row_id;



                    /* CREATE COLOR × SIZE MATRIX */

                    for (
                        const color
                        of colors
                    ) {

                        for (
                            const size
                            of sizes
                        ) {

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

                                    VALUES (
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?
                                    )

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
                        message.includes(
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
            ADMIN PRINTIFY PRODUCTS
            ===================================================== */


            /* =====================================================
            GET PRINTIFY PRODUCTS
            ===================================================== */

            if (
                pathname === "/api/admin/printify/products" &&
                method === "GET"
            ) {

                try {

                    const page =
                        Math.max(
                            1,
                            Number(
                                url.searchParams.get(
                                    "page"
                                ) || 1
                            )
                        );


                    const limit =
                        Math.min(
                            50,
                            Math.max(
                                1,
                                Number(
                                    url.searchParams.get(
                                        "limit"
                                    ) || 20
                                )
                            )
                        );


                    const result =
                        await printifyRequest(
                            env,
                            `/shops/${env.PRINTIFY_SHOP_ID}/products.json` +
                            `?page=${page}&limit=${limit}`
                        );


                    return json({

                        success: true,

                        shop_id:
                            String(
                                env.PRINTIFY_SHOP_ID
                            ),

                        ...result

                    });

                } catch (error) {

                    console.error(
                        "GET PRINTIFY PRODUCTS error:",
                        error
                    );


                    return json({

                        success: false,

                        error:
                            "Failed to load Printify products.",

                        debug:
                            error?.message ||
                            String(error)

                    }, 500);

                }

            }

            /* =====================================================
            GET PRINTIFY PRODUCT DETAIL
            ===================================================== */

            const printifyProductMatch =
                pathname.match(
                    /^\/api\/admin\/printify\/products\/([^/]+)$/
                );


            if (
                printifyProductMatch &&
                method === "GET"
            ) {

                const printifyProductId =
                    printifyProductMatch[1];


                try {

                    const product =
                        await printifyRequest(

                            env,

                            `/shops/${env.PRINTIFY_SHOP_ID}` +
                            `/products/${encodeURIComponent(
                                printifyProductId
                            )}.json`

                        );


                    return json({

                        success: true,

                        product

                    });

                } catch (error) {

                    console.error(
                        "GET PRINTIFY PRODUCT error:",
                        error
                    );


                    return json({

                        success: false,

                        error:
                            "Failed to load Printify product.",

                        debug:
                            error?.message ||
                            String(error)

                    }, 500);

                }

            }

            /* =====================================================
            IMPORT PRINTIFY PRODUCT INTO D1
            ===================================================== */

            if (
                pathname === "/api/admin/printify/import" &&
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



                const printifyProductId =
                    normalizeString(
                        body.printify_product_id,
                        100
                    );


                if (
                    !printifyProductId
                ) {

                    return errorResponse(
                        "Printify product ID is required.",
                        400
                    );

                }



                /*
                * Category can be supplied from Admin.
                * Default to t-shirts.
                */

                const category =
                    normalizeString(
                        body.category,
                        50
                    ) ||
                    "t-shirts";



                /*
                * Selling price.
                *
                * IMPORTANT:
                * Printify's variant.price is normally
                * represented in cents.
                *
                * We use the first enabled variant
                * as the default selling price.
                */

                let sellingPrice =
                    Number(
                        body.price
                    );


                try {

                    /* =============================================
                    GET PRODUCT FROM PRINTIFY
                    ============================================= */

                    const printifyProduct =
                        await printifyRequest(

                            env,

                            `/shops/${env.PRINTIFY_SHOP_ID}` +
                            `/products/${encodeURIComponent(
                                printifyProductId
                            )}.json`

                        );


                    if (
                        !printifyProduct ||
                        !printifyProduct.id
                    ) {

                        return errorResponse(
                            "Printify product not found.",
                            404
                        );

                    }



                    /* =============================================
                    CHECK IF ALREADY IMPORTED
                    ============================================= */

                    const existingProduct =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    name,

                                    slug,

                                    status

                                FROM products

                                WHERE printify_product_id = ?

                                LIMIT 1

                            `)
                            .bind(
                                printifyProduct.id
                            )
                            .first();


                    if (
                        existingProduct
                    ) {

                        return json({

                            success: false,

                            alreadyImported: true,

                            message:
                                "This Printify product is already imported.",

                            product:
                                existingProduct

                        }, 409);

                    }



                    /* =============================================
                    PRODUCT TITLE
                    ============================================= */

                    const productName =
                        normalizeString(
                            printifyProduct.title,
                            200
                        );


                    if (
                        !productName
                    ) {

                        return errorResponse(
                            "Printify product has no title.",
                            400
                        );

                    }



                    /* =============================================
                    SLUG
                    ============================================= */

                    let slug =
                        createSlugFromTitle(
                            productName
                        );


                    if (
                        !slug
                    ) {

                        slug =
                            `product-${Date.now()}`;

                    }



                    /*
                    * Make sure slug is unique.
                    */

                    const slugExists =
                        await env.DB
                            .prepare(`

                                SELECT id

                                FROM products

                                WHERE slug = ?

                                LIMIT 1

                            `)
                            .bind(
                                slug
                            )
                            .first();


                    if (
                        slugExists
                    ) {

                        slug =
                            `${slug}-${Date.now()}`;

                    }

                    /* =============================================
                    PRODUCT IMAGE
                    ============================================= */

                    const productImage =
                        getPrintifyVariantImage(

                            printifyProduct,

                            printifyProduct
                                ?.variants
                                ?.[0]
                                ?.id

                        ) ||
                        printifyProduct
                            ?.images
                            ?.[0]
                            ?.src ||
                        null;


                    if (
                        !isValidImageUrl(
                            productImage
                        )
                    ) {

                        return errorResponse(
                            "Printify product does not have a valid image.",
                            400
                        );

                    }

                    /* =============================================
                    VARIANTS
                    ============================================= */

                    const printifyVariants =
                        Array.isArray(
                            printifyProduct.variants
                        )
                            ? printifyProduct.variants
                            : [];


                    const enabledVariants =
                        printifyVariants.filter(

                            variant =>

                                variant &&
                                variant.is_enabled !== false &&
                                variant.is_available !== false

                        );


                    if (
                        enabledVariants.length === 0
                    ) {

                        return errorResponse(
                            "Printify product has no available variants.",
                            400
                        );

                    }



                    /* =============================================
                    OPTION MAPS
                    ============================================= */

                    const {

                        colorMap,

                        sizeMap

                    } =
                        getPrintifyOptionMaps(
                            printifyProduct
                        );



                    /*
                    * If no price was manually provided,
                    * use the first available variant price.
                    *
                    * Printify price is cents.
                    */

                    if (
                        !Number.isFinite(
                            sellingPrice
                        ) ||
                        sellingPrice <= 0
                    ) {

                        const firstPrice =
                            Number(
                                enabledVariants
                                    ?.[0]
                                    ?.price
                            );


                        if (
                            Number.isFinite(
                                firstPrice
                            ) &&
                            firstPrice > 0
                        ) {

                            sellingPrice =
                                firstPrice / 100;

                        }

                    }



                    if (
                        !Number.isFinite(
                            sellingPrice
                        ) ||
                        sellingPrice <= 0
                    ) {

                        return errorResponse(
                            "A valid selling price is required.",
                            400
                        );

                    }


                    sellingPrice =
                        Number(
                            sellingPrice.toFixed(
                                2
                            )
                        );



                    /* =============================================
                    EXTRACT COLORS + SIZES
                    ============================================= */

                    const colorsMap =
                        new Map();


                    const sizesSet =
                        new Set();


                    for (
                        const variant
                        of enabledVariants
                    ) {

                        const optionIds =
                            Array.isArray(
                                variant.options
                            )
                                ? variant.options
                                : [];


                        let color =
                            null;


                        let size =
                            null;


                        for (
                            const optionId
                            of optionIds
                        ) {

                            const id =
                                Number(
                                    optionId
                                );


                            if (
                                colorMap.has(
                                    id
                                )
                            ) {

                                color =
                                    colorMap.get(
                                        id
                                    );

                            }


                            if (
                                sizeMap.has(
                                    id
                                )
                            ) {

                                size =
                                    sizeMap.get(
                                        id
                                    );

                            }

                        }

                        if (
                            !color ||
                            !size
                        ) {

                            const titleParts =
                                String(
                                    variant.title ||
                                    ""
                                )
                                .split(
                                    " / "
                                )
                                .map(
                                    value =>
                                        value.trim()
                                );


                            if (
                                !color &&
                                titleParts.length
                            ) {

                                const possibleColor =
                                    titleParts.find(
                                        part =>
                                            colorMapHasName(
                                                colorMap,
                                                part
                                            )
                                    );


                                if (
                                    possibleColor
                                ) {

                                    color = {

                                        name:
                                            possibleColor,

                                        hex:
                                            findColorHexByName(
                                                colorMap,
                                                possibleColor
                                            )

                                    };

                                }

                            }


                            if (
                                !size &&
                                titleParts.length
                            ) {

                                const possibleSize =
                                    titleParts.find(
                                        part =>
                                            sizeMapHasName(
                                                sizeMap,
                                                part
                                            )
                                    );


                                if (
                                    possibleSize
                                ) {

                                    size =
                                        possibleSize;

                                }

                            }

                        }



                        if (
                            color &&
                            size
                        ) {

                            const colorKey =
                                String(
                                    color.name
                                )
                                .trim()
                                .toLowerCase();


                            if (
                                !colorsMap.has(
                                    colorKey
                                )
                            ) {

                                colorsMap.set(

                                    colorKey,

                                    {

                                        name:
                                            color.name,

                                        hex:
                                            color.hex ||
                                            "#000000",

                                        image:
                                            getPrintifyVariantImage(
                                                printifyProduct,
                                                variant.id
                                            ) ||
                                            productImage

                                    }

                                );

                            }


                            sizesSet.add(
                                String(
                                    size
                                ).trim()
                            );

                        }

                    }



                    /*
                    * Fallback if the product's options do not
                    * expose color/size in the expected structure.
                    */

                    if (
                        colorsMap.size === 0 ||
                        sizesSet.size === 0
                    ) {

                        return errorResponse(

                            "Could not determine product colors and sizes from Printify variants.",

                            400

                        );

                    }

                    /* =============================================
                    CREATE PRODUCT
                    ============================================= */

                    const productInsert =
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

                                VALUES (

                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    'active'

                                )

                            `)
                            .bind(

                                productName,

                                slug,

                                printifyProduct.description ||
                                    "",

                                sellingPrice,

                                productImage,

                                category,

                                printifyProduct.id

                            )
                            .run();


                    const productId =
                        productInsert
                            .meta
                            ?.last_row_id;


                    if (
                        !productId
                    ) {

                        throw new Error(
                            "Failed to create local product."
                        );

                    }

                    /* =============================================
                    CREATE VARIANTS
                    ============================================= */

                    const statements =
                        [];


                    for (
                        const variant
                        of enabledVariants
                    ) {

                        const optionIds =
                            Array.isArray(
                                variant.options
                            )
                                ? variant.options
                                : [];


                        let color =
                            null;


                        let size =
                            null;


                        for (
                            const optionId
                            of optionIds
                        ) {

                            const id =
                                Number(
                                    optionId
                                );


                            if (
                                colorMap.has(
                                    id
                                )
                            ) {

                                color =
                                    colorMap.get(
                                        id
                                    );

                            }


                            if (
                                sizeMap.has(
                                    id
                                )
                            ) {

                                size =
                                    sizeMap.get(
                                        id
                                    );

                            }

                        }


                        if (
                            !color ||
                            !size
                        ) {

                            const titleParts =
                                String(
                                    variant.title ||
                                    ""
                                )
                                .split(
                                    " / "
                                )
                                .map(
                                    value =>
                                        value.trim()
                                );


                            if (
                                !color
                            ) {

                                const colorName =
                                    titleParts.find(
                                        part =>
                                            colorMapHasName(
                                                colorMap,
                                                part
                                            )
                                    );


                                if (
                                    colorName
                                ) {

                                    color = {

                                        name:
                                            colorName,

                                        hex:
                                            findColorHexByName(
                                                colorMap,
                                                colorName
                                            )

                                    };

                                }

                            }


                            if (
                                !size
                            ) {

                                const sizeName =
                                    titleParts.find(
                                        part =>
                                            sizeMapHasName(
                                                sizeMap,
                                                part
                                            )
                                    );


                                if (
                                    sizeName
                                ) {

                                    size =
                                        sizeName;

                                }

                            }

                        }


                        if (
                            !color ||
                            !size
                        ) {

                            continue;

                        }


                        const image =
                            getPrintifyVariantImage(
                                printifyProduct,
                                variant.id
                            ) ||
                            productImage;


                        statements.push(

                            env.DB
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

                                    VALUES (

                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        'active'

                                    )

                                `)
                                .bind(

                                    productId,

                                    color.name,

                                    color.hex ||
                                        "#000000",

                                    size,

                                    image,

                                    String(
                                        variant.id
                                    )

                                )

                        );

                    }



                    if (
                        statements.length === 0
                    ) {

                        /*
                        * Remove product if no variants
                        * could be imported.
                        */

                        await env.DB
                            .prepare(`

                                DELETE FROM products

                                WHERE id = ?

                            `)
                            .bind(
                                productId
                            )
                            .run();


                        return errorResponse(

                            "No valid variants could be imported.",

                            400

                        );

                    }



                    await env.DB.batch(
                        statements
                    );

                    /* =============================================
                    GET FINAL PRODUCT
                    ============================================= */

                    const importedProduct =
                        await getProductWithVariants(
                            productId,
                            env
                        );


                    return json({

                        success: true,

                        message:
                            "Printify product imported successfully.",

                        product:
                            importedProduct,

                        printify: {

                            product_id:
                                printifyProduct.id,

                            variants_found:
                                enabledVariants.length,

                            variants_imported:
                                statements.length,

                            colors:
                                Array.from(
                                    colorsMap.values()
                                ),

                            sizes:
                                Array.from(
                                    sizesSet
                                )

                        }

                    });

                } catch (error) {

                    console.error(
                        "IMPORT PRINTIFY PRODUCT error:",
                        error
                    );


                    return json({

                        success: false,

                        error:
                            "Failed to import Printify product.",

                        debug:
                            error?.message ||
                            String(error)

                    }, 500);

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

                            fields.image ||
                                null,

                            fields.category ||
                                null,

                            fields.printify_product_id ||
                                null,

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
                        const variant
                        of oldVariants
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

                    for (
                        const color
                        of colors
                    ) {

                        for (
                            const size
                            of sizes
                        ) {

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

                                    VALUES (
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?
                                    )

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
                        message.includes(
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
                        const variant
                        of oldVariants
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

                    for (
                        const color
                        of colors
                    ) {

                        for (
                            const size
                            of sizes
                        ) {

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

                                    VALUES (
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?
                                    )

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

            if (
                pathname === "/api/debug-admin" &&
                method === "GET"
            ) {

                return json({
                    exists: !!env.ADMIN_TOKEN,
                    length: env.ADMIN_TOKEN
                        ? env.ADMIN_TOKEN.length
                        : 0
                });

            }

                        /* =====================================================
            CREATE PAYPAL CHECKOUT
            ===================================================== */

            if (
                pathname === "/api/checkout" &&
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



                /* =============================================
                   VALIDATE CART
                   ============================================= */

                const cart =
                    Array.isArray(
                        body.cart
                    )
                        ? body.cart
                        : [];


                if (
                    cart.length === 0 ||
                    cart.length > 50
                ) {

                    return errorResponse(
                        "Your cart is empty or invalid.",
                        400
                    );

                }



                /* =============================================
                   CUSTOMER
                   ============================================= */

                const customer =
                    body.customer || {};


                const email =
                    normalizeString(
                        customer.email,
                        150
                    );


                const phone =
                    normalizeString(
                        customer.phone,
                        30
                    );


                if (
                    !email ||
                    !email.includes("@")
                ) {

                    return errorResponse(
                        "A valid email address is required.",
                        400
                    );

                }



                /* =============================================
                   SHIPPING ADDRESS
                   ============================================= */

                const address =
                    body.shippingAddress || {};


                const firstName =
                    normalizeString(
                        address.firstName,
                        50
                    );


                const lastName =
                    normalizeString(
                        address.lastName,
                        50
                    );


                const addressLine =
                    normalizeString(
                        address.address,
                        150
                    );


                const apartment =
                    normalizeString(
                        address.apartment,
                        100
                    );


                const city =
                    normalizeString(
                        address.city,
                        80
                    );


                const state =
                    normalizeString(
                        address.state,
                        50
                    ).toUpperCase();


                const zip =
                    normalizeString(
                        address.zip,
                        20
                    );


                const country =
                    normalizeString(
                        address.country,
                        2
                    ).toUpperCase();


                if (
                    !firstName ||
                    !lastName ||
                    !addressLine ||
                    !city ||
                    !state ||
                    !zip ||
                    !country
                ) {

                    return errorResponse(
                        "Shipping address is incomplete.",
                        400
                    );

                }


                if (
                    country !== "US"
                ) {

                    return errorResponse(
                        "Currently, shipping is only available in the United States.",
                        400
                    );

                }


                /* =============================================
                   LOAD PRODUCTS FROM DATABASE
                   NEVER TRUST CLIENT PRICE
                   ============================================= */

                const validatedItems =
                    [];


                let subtotal =
                    0;


                for (
                    const cartItem
                    of cart
                ) {

                    const productId =
                        Number(
                            cartItem.productId
                        );


                    if (
                        !Number.isInteger(
                            productId
                        ) ||
                        productId <= 0
                    ) {

                        return errorResponse(
                            "Invalid product ID.",
                            400
                        );

                    }


                    const color =
                        normalizeVariantColor(
                            cartItem.color
                        );


                    const size =
                        normalizeVariantSize(
                            cartItem.size
                        );


                    let quantity =
                        Number(
                            cartItem.quantity
                        );


                    if (
                        !Number.isInteger(
                            quantity
                        )
                    ) {

                        return errorResponse(
                            "Invalid product quantity.",
                            400
                        );

                    }


                    quantity =
                        Math.max(
                            1,
                            Math.min(
                                quantity,
                                10
                            )
                        );


                    if (
                        !color ||
                        !size
                    ) {

                        return errorResponse(
                            "Please select a valid color and size.",
                            400
                        );

                    }

                    /* GET PRODUCT */

                    const product =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    name,

                                    price,

                                    status

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
                            "One of the products is no longer available.",
                            400
                        );

                    }


                    /* GET EXACT VARIANT */

                    const variant =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    color_name,

                                    size,

                                    printify_variant_id,

                                    status

                                FROM product_variants

                                WHERE product_id = ?

                                AND LOWER(color_name) = LOWER(?)

                                AND UPPER(size) = UPPER(?)

                                AND status = 'active'

                            `)
                            .bind(

                                productId,

                                color,

                                size

                            )
                            .first();


                    if (!variant) {

                        return errorResponse(
                            `${product.name} in ${color} / ${size} is not available.`,
                            400
                        );

                    }



                    const price =
                        Number(
                            product.price
                        );


                    if (
                        !Number.isFinite(
                            price
                        ) ||
                        price < 0
                    ) {

                        return errorResponse(
                            "Invalid product price.",
                            500
                        );

                    }


                    const lineTotal =
                        price *
                        quantity;


                    subtotal +=
                        lineTotal;


                    validatedItems.push({

                        productId:
                            product.id,

                        variantId:
                            variant.id,

                        productName:
                            product.name,

                        color:
                            variant.color_name,

                        size:
                            variant.size,

                        price,

                        quantity,

                        lineTotal,

                        printifyVariantId:
                            variant.printify_variant_id

                    });

                }



                /* =============================================
                   SHIPPING
                   ============================================= */

                const shipping =
                    subtotal >= 50
                        ? 0
                        : 5.99;


                /*
                 * TAX
                 *
                 * Currently set to 0 for the sandbox/demo stage.
                 * Real tax calculation should be added later.
                 */

                const tax =
                    0;


                const total =
                    subtotal +
                    shipping +
                    tax;



                /* =============================================
                   CREATE LOCAL ORDER FIRST
                   ============================================= */

                const orderNumber =
                    createOrderNumber();


                let localOrderId;


                try {

                    const result =
                        await env.DB
                            .prepare(`

                                INSERT INTO orders (

                                    order_number,

                                    customer_email,

                                    customer_first_name,

                                    customer_last_name,

                                    shipping_address,

                                    shipping_apartment,

                                    shipping_city,

                                    shipping_state,

                                    shipping_zip,

                                    shipping_country,

                                    customer_phone,

                                    subtotal,

                                    shipping,

                                    tax,

                                    total,

                                    currency,

                                    status,

                                    payment_status

                                )

                                VALUES (

                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    'USD',
                                    'pending',
                                    'unpaid'

                                )

                            `)
                            .bind(

                                orderNumber,

                                email,

                                firstName,

                                lastName,

                                addressLine,

                                apartment ||
                                    null,

                                city,

                                state,

                                zip,

                                country,

                                phone ||
                                    null,

                                subtotal,

                                shipping,

                                tax,

                                total

                            )
                            .run();


                    localOrderId =
                        result.meta
                            ?.last_row_id;


                    if (!localOrderId) {

                        throw new Error(
                            "Unable to create local order."
                        );

                    }



                    /* =========================================
                       CREATE ORDER ITEMS
                       ========================================= */

                    for (
                        const item
                        of validatedItems
                    ) {

                        await env.DB
                            .prepare(`

                                INSERT INTO order_items (

                                    order_id,

                                    product_id,

                                    variant_id,

                                    product_name,

                                    color,

                                    size,

                                    price,

                                    quantity

                                )

                                VALUES (

                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?

                                )

                            `)
                            .bind(

                                localOrderId,

                                item.productId,

                                item.variantId,

                                item.productName,

                                item.color,

                                item.size,

                                item.price,

                                item.quantity

                            )
                            .run();

                    }


                } catch (error) {

                    console.error(
                        "CREATE LOCAL ORDER error:",
                        error
                    );


                    return errorResponse(
                        "Unable to create your order.",
                        500
                    );

                }



                /* =============================================
                   CREATE PAYPAL ORDER
                   ============================================= */

                try {

                    const successUrl =
                        url.origin +
                        "/payment-success.html";


                    const cancelUrl =
                        url.origin +
                        "/checkout.html?cancelled=1";


                    const paypalItems =
                        validatedItems.map(
                            function(item) {

                                return {

                                    name:
                                        item.productName,

                                    quantity:
                                        String(
                                            item.quantity
                                        ),

                                    category:
                                        "PHYSICAL_GOODS",

                                    sku:
                                        String(
                                            item.variantId
                                        ),

                                    unit_amount: {

                                        currency_code:
                                            "USD",

                                        value:
                                            formatUsd(
                                                item.price
                                            )

                                    }

                                };

                            }
                        );


                    const paypalOrder =
                        await createPayPalOrder(
                            env,
                            {

                                intent:
                                    "CAPTURE",


                                payment_source: {

                                    paypal: {

                                        experience_context: {

                                            return_url:
                                                successUrl,

                                            cancel_url:
                                                cancelUrl,

                                            user_action:
                                                "PAY_NOW",

                                            shipping_preference:
                                                "SET_PROVIDED_ADDRESS"

                                        }

                                    }

                                },


                                purchase_units: [

                                    {

                                        reference_id:
                                            String(
                                                localOrderId
                                            ),

                                        invoice_id:
                                            orderNumber,

                                        description:
                                            "Threadly Co. Order " +
                                            orderNumber,


                                        amount: {

                                            currency_code:
                                                "USD",

                                            value:
                                                formatUsd(
                                                    total
                                                ),

                                            breakdown: {

                                                item_total: {

                                                    currency_code:
                                                        "USD",

                                                    value:
                                                        formatUsd(
                                                            subtotal
                                                        )

                                                },


                                                shipping: {

                                                    currency_code:
                                                        "USD",

                                                    value:
                                                        formatUsd(
                                                            shipping
                                                        )

                                                },


                                                tax_total: {

                                                    currency_code:
                                                        "USD",

                                                    value:
                                                        formatUsd(
                                                            tax
                                                        )

                                                }

                                            }

                                        },


                                        items:
                                            paypalItems,


                                        shipping: {

                                            name: {

                                                full_name:
                                                    firstName +
                                                    " " +
                                                    lastName

                                            },


                                            address: {

                                                address_line_1:
                                                    addressLine,

                                                address_line_2:
                                                    apartment ||
                                                    undefined,

                                                admin_area_2:
                                                    city,

                                                admin_area_1:
                                                    state,

                                                postal_code:
                                                    zip,

                                                country_code:
                                                    country

                                            }

                                        }

                                    }

                                ]

                            }
                        );


                    if (
                        !paypalOrder ||
                        !paypalOrder.id
                    ) {

                        throw new Error(
                            "PayPal did not return an order ID."
                        );

                    }



                    /* =========================================
                       SAVE PAYPAL ORDER ID
                       ========================================= */

                    await env.DB
                        .prepare(`

                            UPDATE orders

                            SET

                                paypal_order_id = ?,

                                updated_at = CURRENT_TIMESTAMP

                            WHERE id = ?

                        `)
                        .bind(

                            paypalOrder.id,

                            localOrderId

                        )
                        .run();



                    /* =========================================
                       FIND APPROVAL URL
                       ========================================= */

                    const approvalLink =
                        Array.isArray(
                            paypalOrder.links
                        )
                            ? paypalOrder.links.find(
                                link =>
                                    link.rel === "payer-action" ||
                                    link.rel === "approve"
                            )
                            : null;


                    if (
                        !approvalLink ||
                        !approvalLink.href
                    ) {

                        throw new Error(
                            "PayPal approval URL was not returned."
                        );

                    }


                    return json({

                        success: true,

                        orderId:
                            localOrderId,

                        orderNumber,

                        paypalOrderId:
                            paypalOrder.id,

                        approvalUrl:
                            approvalLink.href

                    });


                } catch (error) {

                    console.error(
                        "CREATE PAYPAL ORDER error:",
                        error
                    );


                    /*
                     * Keep the order in the database
                     * but mark it as failed.
                     */

                    if (localOrderId) {

                        await env.DB
                            .prepare(`

                                UPDATE orders

                                SET

                                    status = 'failed',

                                    updated_at = CURRENT_TIMESTAMP

                                WHERE id = ?

                            `)
                            .bind(
                                localOrderId
                            )
                            .run();

                    }


                    return errorResponse(
                        "Unable to start PayPal checkout.",
                        500
                    );

                }

            }

            /* =====================================================
            CAPTURE PAYPAL PAYMENT + SUBMIT TO PRINTIFY
            ===================================================== */

            if (
                pathname === "/api/paypal/capture" &&
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


                const paypalOrderId =
                    normalizeString(
                        body.paypalOrderId,
                        100
                    );


                if (!paypalOrderId) {

                    return errorResponse(
                        "PayPal order ID is required.",
                        400
                    );

                }


                /* =============================================
                FIND LOCAL ORDER
                ============================================= */

                const order =
                    await env.DB
                        .prepare(`

                            SELECT
                                id,
                                order_number,
                                customer_email,
                                customer_first_name,
                                customer_last_name,
                                shipping_address,
                                shipping_apartment,
                                shipping_city,
                                shipping_state,
                                shipping_zip,
                                shipping_country,
                                customer_phone,
                                payment_status,
                                status,
                                paypal_order_id,
                                paypal_capture_id,
                                printify_order_id

                            FROM orders

                            WHERE paypal_order_id = ?

                            LIMIT 1

                        `)
                        .bind(
                            paypalOrderId
                        )
                        .first();


                if (!order) {

                    return errorResponse(
                        "Order not found.",
                        404
                    );

                }


                /* =============================================
                PREVENT DUPLICATE PROCESSING
                ============================================= */

                if (
                    order.payment_status === "paid" &&
                    order.printify_order_id
                ) {

                    return json({

                        success: true,

                        alreadyCaptured: true,

                        alreadySubmittedToPrintify: true,

                        orderNumber:
                            order.order_number,

                        printifyOrderId:
                            order.printify_order_id

                    });

                }


                /* =============================================
                CAPTURE PAYPAL
                ============================================= */

                let captureId =
                    order.paypal_capture_id ||
                    null;


                if (
                    order.payment_status !== "paid"
                ) {

                    try {

                        const paypalResult =
                            await capturePayPalOrder(
                                env,
                                paypalOrderId
                            );


                        if (
                            paypalResult.status !==
                            "COMPLETED"
                        ) {

                            console.error(
                                "Unexpected PayPal status:",
                                paypalResult
                            );

                            return errorResponse(
                                "Payment was not completed.",
                                400
                            );

                        }


                        /* =========================================
                        GET CAPTURE ID
                        ========================================= */

                        const purchaseUnit =
                            paypalResult
                                .purchase_units
                                ?.[0];


                        const capture =
                            purchaseUnit
                                ?.payments
                                ?.captures
                                ?.[0];


                        if (
                            capture &&
                            capture.id
                        ) {

                            captureId =
                                capture.id;

                        }


                        /* =========================================
                        UPDATE LOCAL ORDER
                        ========================================= */

                        await env.DB
                            .prepare(`

                                UPDATE orders

                                SET

                                    payment_status = 'paid',

                                    status = 'processing',

                                    paypal_capture_id = ?,

                                    updated_at = CURRENT_TIMESTAMP

                                WHERE id = ?

                            `)
                            .bind(

                                captureId,

                                order.id

                            )
                            .run();


                    } catch (error) {

                        console.error(
                            "PAYPAL CAPTURE error:",
                            error
                        );

                        return errorResponse(
                            "Unable to capture PayPal payment.",
                            500
                        );

                    }

                }


                /* =============================================
                CHECK IF ALREADY SUBMITTED TO PRINTIFY
                ============================================= */

                const currentOrder =
                    await env.DB
                        .prepare(`

                            SELECT

                                id,

                                printify_order_id

                            FROM orders

                            WHERE id = ?

                            LIMIT 1

                        `)
                        .bind(
                            order.id
                        )
                        .first();


                if (
                    currentOrder?.printify_order_id
                ) {

                    return json({

                        success: true,

                        orderNumber:
                            order.order_number,

                        orderId:
                            order.id,

                        paypalOrderId,

                        paypalCaptureId:
                            captureId,

                        printifyOrderId:
                            currentOrder.printify_order_id,

                        alreadySubmittedToPrintify:
                            true

                    });

                }


                /* =============================================
                GET ORDER ITEMS + PRINTIFY IDs
                ============================================= */

                const itemsResult =
                    await env.DB
                        .prepare(`

                            SELECT

                                oi.id,

                                oi.product_id,

                                oi.variant_id,

                                oi.quantity,

                                p.printify_product_id,

                                pv.printify_variant_id

                            FROM order_items oi

                            INNER JOIN products p

                                ON p.id = oi.product_id

                            INNER JOIN product_variants pv

                                ON pv.id = oi.variant_id

                            WHERE oi.order_id = ?

                            ORDER BY oi.id ASC

                        `)
                        .bind(
                            order.id
                        )
                        .all();


                const items =
                    itemsResult.results ||
                    [];


                if (!items.length) {

                    const message =
                        "Order has no items.";

                    await env.DB
                        .prepare(`

                            UPDATE orders

                            SET

                                printify_error = ?,

                                status = 'failed',

                                updated_at = CURRENT_TIMESTAMP

                            WHERE id = ?

                        `)
                        .bind(
                            message,
                            order.id
                        )
                        .run();


                    return errorResponse(
                        message,
                        500
                    );

                }


                /* =============================================
                BUILD PRINTIFY LINE ITEMS
                ============================================= */

                const printifyLineItems =
                    [];


                for (
                    const item
                    of items
                ) {

                    if (
                        !item.printify_product_id ||
                        !item.printify_variant_id
                    ) {

                        const message =
                            `Missing Printify product or variant ID for order item ${item.id}.`;


                        await env.DB
                            .prepare(`

                                UPDATE orders

                                SET

                                    printify_error = ?,

                                    updated_at = CURRENT_TIMESTAMP

                                WHERE id = ?

                            `)
                            .bind(
                                message,
                                order.id
                            )
                            .run();


                        return errorResponse(
                            message,
                            500
                        );

                    }


                    printifyLineItems.push({

                        product_id:
                            String(
                                item.printify_product_id
                            ),

                        variant_id:
                            Number(
                                item.printify_variant_id
                            ),

                        quantity:
                            Number(
                                item.quantity
                            ),

                        external_id:
                            String(
                                item.id
                            )

                    });

                }


                /* =============================================
                BUILD PRINTIFY ORDER
                ============================================= */

                const printifyOrderData = {

                    external_id:
                        String(
                            order.id
                        ),

                    label:
                        order.order_number,

                    line_items:
                        printifyLineItems,

                    shipping_method:
                        1,

                    send_shipping_notification:
                        false,

                    address_to: {

                        first_name:
                            order.customer_first_name,

                        last_name:
                            order.customer_last_name,

                        email:
                            order.customer_email,

                        phone:
                            order.customer_phone ||
                            "",

                        country:
                            order.shipping_country,

                        region:
                            order.shipping_state ||
                            "",

                        address1:
                            order.shipping_address,

                        address2:
                            order.shipping_apartment ||
                            "",

                        city:
                            order.shipping_city,

                        zip:
                            order.shipping_zip

                    }

                };


                /* =============================================
                SUBMIT ORDER TO PRINTIFY
                ============================================= */

                try {

                    console.log(
                        "SUBMITTING ORDER TO PRINTIFY:",
                        JSON.stringify(
                            printifyOrderData
                        )
                    );


                    const printifyResult =
                        await createPrintifyOrder(
                            env,
                            printifyOrderData
                        );


                    if (
                        !printifyResult ||
                        !printifyResult.id
                    ) {

                        throw new Error(
                            "Printify did not return an order ID."
                        );

                    }


                    /* =========================================
                    SAVE PRINTIFY ORDER ID
                    ========================================= */

                    await env.DB
                        .prepare(`

                            UPDATE orders

                            SET

                                printify_order_id = ?,

                                printify_error = NULL,

                                printify_submitted_at =
                                    CURRENT_TIMESTAMP,

                                status = 'processing',

                                updated_at =
                                    CURRENT_TIMESTAMP

                            WHERE id = ?

                        `)
                        .bind(

                            String(
                                printifyResult.id
                            ),

                            order.id

                        )
                        .run();


                    console.log(
                        "PRINTIFY ORDER CREATED:",
                        printifyResult.id
                    );


                    return json({

                        success: true,

                        orderNumber:
                            order.order_number,

                        orderId:
                            order.id,

                        paypalOrderId,

                        paypalCaptureId:
                            captureId,

                        printifyOrderId:
                            printifyResult.id

                    });


                } catch (error) {

                    console.error(
                        "PRINTIFY SUBMISSION ERROR:",
                        error
                    );


                    const errorMessage =
                        error?.message ||
                        String(error);


                    await env.DB
                        .prepare(`

                            UPDATE orders

                            SET

                                printify_error = ?,

                                status = 'processing',

                                updated_at =
                                    CURRENT_TIMESTAMP

                            WHERE id = ?

                        `)
                        .bind(

                            errorMessage
                                .slice(0, 2000),

                            order.id

                        )
                        .run();


                    /*
                    * IMPORTANT:
                    *
                    * PayPal payment was successful.
                    * Printify submission failed.
                    *
                    * Do NOT return a fake "payment failed".
                    */

                    return json({

                        success: true,

                        paymentCaptured:
                            true,

                        printifySubmitted:
                            false,

                        orderNumber:
                            order.order_number,

                        orderId:
                            order.id,

                        paypalOrderId,

                        paypalCaptureId:
                            captureId,

                        printifyError:
                            errorMessage

                    }, 202);

                }

            }

            /* =====================================================
            PAYPAL DEBUG
            ===================================================== */

                        /* =====================================================
            ADMIN ORDERS API
            ===================================================== */


            /* =====================================================
            ORDER STATUS HELPERS
            ===================================================== */

            function isValidOrderStatus(status) {

                return [
                    "pending",
                    "processing",
                    "shipping",
                    "shipped",
                    "completed",
                    "delivered",
                    "cancelled",
                    "failed"
                ].includes(status);

            }


            function isValidPaymentStatus(status) {

                return [
                    "unpaid",
                    "paid",
                    "refunded"
                ].includes(status);

            }



            /* =====================================================
            ADMIN ORDER ROUTE MATCH
            ===================================================== */

            const adminOrderMatch =
                pathname.match(
                    /^\/api\/admin\/orders\/(\d+)$/
                );



            /* =====================================================
            ADMIN GET ALL ORDERS
            ===================================================== */

            if (
                pathname === "/api/admin/orders" &&
                method === "GET"
            ) {

                try {

                    const search =
                        normalizeString(
                            url.searchParams.get("search"),
                            200
                        );


                    const status =
                        normalizeString(
                            url.searchParams.get("status"),
                            30
                        ).toLowerCase();


                    const paymentStatus =
                        normalizeString(
                            url.searchParams.get(
                                "payment_status"
                            ),
                            30
                        ).toLowerCase();



                    /* =============================================
                       PAGINATION
                    ============================================= */

                    let page =
                        Number(
                            url.searchParams.get("page")
                        );


                    let limit =
                        Number(
                            url.searchParams.get("limit")
                        );


                    if (
                        !Number.isInteger(page) ||
                        page < 1
                    ) {

                        page = 1;

                    }


                    if (
                        !Number.isInteger(limit) ||
                        limit < 1
                    ) {

                        limit = 20;

                    }


                    limit =
                        Math.min(
                            limit,
                            100
                        );


                    const offset =
                        (page - 1) *
                        limit;



                    /* =============================================
                       VALIDATE FILTERS
                    ============================================= */

                    if (
                        status &&
                        !isValidOrderStatus(status)
                    ) {

                        return errorResponse(
                            "Invalid order status.",
                            400
                        );

                    }


                    if (
                        paymentStatus &&
                        !isValidPaymentStatus(
                            paymentStatus
                        )
                    ) {

                        return errorResponse(
                            "Invalid payment status.",
                            400
                        );

                    }



                    /* =============================================
                       BUILD WHERE CLAUSE
                    ============================================= */

                    const conditions = [];
                    const bindings = [];


                    if (search) {

                        conditions.push(`

                            (
                                order_number LIKE ?
                                OR customer_email LIKE ?
                                OR customer_first_name LIKE ?
                                OR customer_last_name LIKE ?
                                OR (
                                    customer_first_name ||
                                    ' ' ||
                                    customer_last_name
                                ) LIKE ?
                            )

                        `);


                        const searchPattern =
                            `%${search}%`;


                        bindings.push(
                            searchPattern,
                            searchPattern,
                            searchPattern,
                            searchPattern,
                            searchPattern
                        );

                    }


                    if (status) {

                        conditions.push(
                            "status = ?"
                        );


                        bindings.push(
                            status
                        );

                    }


                    if (paymentStatus) {

                        conditions.push(
                            "payment_status = ?"
                        );


                        bindings.push(
                            paymentStatus
                        );

                    }



                    const whereClause =
                        conditions.length
                            ? "WHERE " +
                              conditions.join(
                                  " AND "
                              )
                            : "";



                    /* =============================================
                       COUNT ORDERS
                    ============================================= */

                    const countQuery = `

                        SELECT

                            COUNT(*) AS total

                        FROM orders

                        ${whereClause}

                    `;


                    const countResult =
                        await env.DB
                            .prepare(
                                countQuery
                            )
                            .bind(
                                ...bindings
                            )
                            .first();


                    const totalOrders =
                        Number(
                            countResult?.total || 0
                        );


                    const totalPages =
                        Math.ceil(
                            totalOrders /
                            limit
                        );



                    /* =============================================
                       GET ORDERS
                    ============================================= */

                    const ordersQuery = `

                        SELECT

                            id,

                            order_number,

                            customer_email,

                            customer_first_name,

                            customer_last_name,

                            shipping_address,

                            shipping_apartment,

                            shipping_city,

                            shipping_state,

                            shipping_zip,

                            shipping_country,

                            customer_phone,

                            subtotal,

                            shipping,

                            tax,

                            total,

                            currency,

                            status,

                            payment_status,

                            paypal_order_id,

                            paypal_capture_id,

                            created_at,

                            updated_at

                        FROM orders

                        ${whereClause}

                        ORDER BY id DESC

                        LIMIT ?

                        OFFSET ?

                    `;


                    const ordersResult =
                        await env.DB
                            .prepare(
                                ordersQuery
                            )
                            .bind(
                                ...bindings,
                                limit,
                                offset
                            )
                            .all();


                    const orders =
                        ordersResult.results ||
                        [];


                    /* =============================================
                    GET ITEM COUNTS
                    ============================================= */

                    for (
                        const order
                        of orders
                    ) {

                        try {

                            const itemSummary =
                                await env.DB
                                    .prepare(`

                                        SELECT

                                            COUNT(*) AS line_count,

                                            COALESCE(
                                                SUM(quantity),
                                                0
                                            ) AS item_count

                                        FROM order_items

                                        WHERE order_id = ?

                                    `)
                                    .bind(
                                        order.id
                                    )
                                    .first();


                            order.line_count =
                                Number(
                                    itemSummary?.line_count || 0
                                );


                            order.item_count =
                                Number(
                                    itemSummary?.item_count || 0
                                );


                        } catch (error) {

                            console.error(
                                "GET ORDER ITEM COUNT error:",
                                error
                            );


                            order.line_count = 0;

                            order.item_count = 0;

                        }

                    }



                    /* =============================================
                       TOTAL REVENUE FOR CURRENT FILTER
                    ============================================= */

                    const revenueResult =
                        await env.DB
                            .prepare(`

                                SELECT

                                    COALESCE(
                                        SUM(total),
                                        0
                                    ) AS revenue

                                FROM orders

                                ${whereClause}

                            `)
                            .bind(
                                ...bindings
                            )
                            .first();


                    const filteredRevenue =
                        Number(
                            revenueResult?.revenue ||
                            0
                        );



                    /* =============================================
                       RESPONSE
                    ============================================= */

                    return json({

                        success: true,

                        orders,

                        pagination: {

                            page,

                            limit,

                            total:
                                totalOrders,

                            totalPages,

                            hasNextPage:
                                page <
                                totalPages,

                            hasPreviousPage:
                                page > 1

                        },

                        summary: {

                            totalOrders,

                            filteredRevenue:
                                Number(
                                    filteredRevenue.toFixed(
                                        2
                                    )
                                )

                        }

                    });


                } catch (error) {

                    console.error(
                        "ADMIN GET ORDER error:",
                        error
                    );

                    return json({
                        success: false,
                        error: "Failed to load order.",
                        debug: error?.message || String(error)
                    }, 500);

                }

            }



            /* =====================================================
            ADMIN GET SINGLE ORDER
            ===================================================== */

            if (
                adminOrderMatch &&
                method === "GET"
            ) {

                const orderId =
                    Number(
                        adminOrderMatch[1]
                    );


                try {

                    if (
                        !Number.isInteger(
                            orderId
                        ) ||
                        orderId <= 0
                    ) {

                        return errorResponse(
                            "Invalid order ID.",
                            400
                        );

                    }



                    /* =============================================
                       GET ORDER
                    ============================================= */

                    const order =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    order_number,

                                    customer_email,

                                    customer_first_name,

                                    customer_last_name,

                                    shipping_address,

                                    shipping_apartment,

                                    shipping_city,

                                    shipping_state,

                                    shipping_zip,

                                    shipping_country,

                                    customer_phone,

                                    subtotal,

                                    shipping,

                                    tax,

                                    total,

                                    currency,

                                    status,

                                    payment_status,

                                    paypal_order_id,

                                    paypal_capture_id,

                                    created_at,

                                    updated_at

                                FROM orders

                                WHERE id = ?

                            `)
                            .bind(
                                orderId
                            )
                            .first();


                    if (!order) {

                        return errorResponse(
                            "Order not found.",
                            404
                        );

                    }

                    /* =============================================
                       GET ORDER ITEMS
                    ============================================= */

                    const itemsResult =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    order_id,

                                    product_id,

                                    variant_id,

                                    product_name,

                                    color,

                                    size,

                                    price,

                                    quantity

                                FROM order_items

                                WHERE order_id = ?

                                ORDER BY id ASC

                            `)
                            .bind(
                                orderId
                            )
                            .all();


                    const items =
                        itemsResult.results ||
                        [];

                    /* =============================================
                       NORMALIZE NUMBERS
                    ============================================= */

                    order.subtotal =
                        Number(
                            order.subtotal || 0
                        );


                    order.shipping =
                        Number(
                            order.shipping || 0
                        );


                    order.tax =
                        Number(
                            order.tax || 0
                        );


                    order.total =
                        Number(
                            order.total || 0
                        );


                    for (
                        const item
                        of items
                    ) {

                        item.price =
                            Number(
                                item.price || 0
                            );


                        item.quantity =
                            Number(
                                item.quantity || 0
                            );


                        item.line_total =
                            Number(
                                (
                                    item.price *
                                    item.quantity
                                ).toFixed(2)
                            );

                    }



                    /* =============================================
                       BUILD RESPONSE
                    ============================================= */

                    order.items =
                        items;


                    order.item_count =
                        items.reduce(
                            (
                                total,
                                item
                            ) =>
                                total +
                                Number(
                                    item.quantity ||
                                    0
                                ),
                            0
                        );


                    order.line_count =
                        items.length;



                    return json({

                        success: true,

                        order

                    });


                } catch (error) {

                    console.error(
                        "ADMIN GET ORDER error:",
                        error
                    );

                    return json({
                        success: false,
                        error: "Failed to load order.",
                        debug: error?.message || String(error)
                    }, 500);

                }

            }



            /* =====================================================
            ADMIN UPDATE ORDER
            ===================================================== */

            if (
                adminOrderMatch &&
                method === "PUT"
            ) {

                const orderId =
                    Number(
                        adminOrderMatch[1]
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



                /* =============================================
                   VALIDATE ORDER ID
                ============================================= */

                if (
                    !Number.isInteger(
                        orderId
                    ) ||
                    orderId <= 0
                ) {

                    return errorResponse(
                        "Invalid order ID.",
                        400
                    );

                }



                /* =============================================
                   GET CURRENT ORDER
                ============================================= */

                try {

                    const existingOrder =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    order_number,

                                    status,

                                    payment_status

                                FROM orders

                                WHERE id = ?

                            `)
                            .bind(
                                orderId
                            )
                            .first();


                    if (!existingOrder) {

                        return errorResponse(
                            "Order not found.",
                            404
                        );

                    }



                    /* =============================================
                       NORMALIZE INPUT
                    ============================================= */

                    let newStatus =
                        normalizeString(
                            body.status,
                            30
                        ).toLowerCase();


                    let newPaymentStatus =
                        normalizeString(
                            body.payment_status,
                            30
                        ).toLowerCase();



                    /*
                     * Allow partial updates.
                     */

                    if (!newStatus) {

                        newStatus =
                            existingOrder.status;

                    }


                    if (!newPaymentStatus) {

                        newPaymentStatus =
                            existingOrder.payment_status;

                    }



                    /* =============================================
                       VALIDATE STATUS
                    ============================================= */

                    if (
                        !isValidOrderStatus(
                            newStatus
                        )
                    ) {

                        return errorResponse(
                            "Invalid order status.",
                            400
                        );

                    }


                    if (
                        !isValidPaymentStatus(
                            newPaymentStatus
                        )
                    ) {

                        return errorResponse(
                            "Invalid payment status.",
                            400
                        );

                    }



                    /* =============================================
                       STATUS LOGIC
                    ============================================= */

                    /*
                     * A delivered / shipped order
                     * should normally be paid.
                     *
                     * We don't silently modify payment_status,
                     * but prevent obviously invalid combinations.
                     */

                    if (
                        (
                            newStatus === "shipping" ||
                            newStatus === "shipped" ||
                            newStatus === "completed" ||
                            newStatus === "delivered"
                        ) &&
                        newPaymentStatus !== "paid"
                    ) {

                        return errorResponse(
                            "An order must be paid before it can be marked as shipping or completed.",
                            400
                        );

                    }

                    /*
                     * A refunded order should not remain
                     * marked as paid.
                     */

                    if (
                        newPaymentStatus === "refunded" &&
                        newStatus === "failed"
                    ) {

                        return errorResponse(
                            "A refunded order cannot have failed status.",
                            400
                        );

                    }



                    /* =============================================
                       UPDATE ORDER
                    ============================================= */

                    await env.DB
                        .prepare(`

                            UPDATE orders

                            SET

                                status = ?,

                                payment_status = ?,

                                updated_at =
                                    CURRENT_TIMESTAMP

                            WHERE id = ?

                        `)
                        .bind(

                            newStatus,

                            newPaymentStatus,

                            orderId

                        )
                        .run();



                    /* =============================================
                       GET UPDATED ORDER
                    ============================================= */

                    const updatedOrder =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    order_number,

                                    customer_email,

                                    customer_first_name,

                                    customer_last_name,

                                    shipping_address,

                                    shipping_apartment,

                                    shipping_city,

                                    shipping_state,

                                    shipping_zip,

                                    shipping_country,

                                    customer_phone,

                                    subtotal,

                                    shipping,

                                    tax,

                                    total,

                                    currency,

                                    status,

                                    payment_status,

                                    paypal_order_id,

                                    paypal_capture_id,

                                    created_at,

                                    updated_at

                                FROM orders

                                WHERE id = ?

                            `)
                            .bind(
                                orderId
                            )
                            .first();



                    /* =============================================
                       GET UPDATED ITEMS
                    ============================================= */

                    const itemsResult =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    order_id,

                                    product_id,

                                    variant_id,

                                    product_name,

                                    color,

                                    size,

                                    price,

                                    quantity

                                FROM order_items

                                WHERE order_id = ?

                                ORDER BY id ASC

                            `)
                            .bind(
                                orderId
                            )
                            .all();


                    updatedOrder.items =
                        itemsResult.results ||
                        [];



                    return json({

                        success: true,

                        message:
                            "Order updated successfully.",

                        order:
                            updatedOrder

                    });


                } catch (error) {

                    console.error(
                        "ADMIN UPDATE ORDER error:",
                        error
                    );


                    return errorResponse(
                        "Failed to update order.",
                        500
                    );

                }

            }

            if (
                pathname === "/api/debug-paypal" &&
                method === "GET"
            ) {

                return json({

                    mode:
                        env.PAYPAL_MODE || null,

                    clientIdExists:
                        !!env.PAYPAL_CLIENT_ID,

                    clientIdLength:
                        env.PAYPAL_CLIENT_ID
                            ? env.PAYPAL_CLIENT_ID.length
                            : 0,

                    secretExists:
                        !!env.PAYPAL_CLIENT_SECRET,

                    secretLength:
                        env.PAYPAL_CLIENT_SECRET
                            ? env.PAYPAL_CLIENT_SECRET.length
                            : 0

                });

            }

            /* =====================================================
            PRINTIFY SHOP DEBUG
            ===================================================== */

            if (
                pathname === "/api/debug-printify-shop" &&
                method === "GET"
            ) {

                try {

                    if (!env.PRINTIFY_API_TOKEN) {

                        return errorResponse(
                            "PRINTIFY_API_TOKEN is not configured.",
                            500
                        );

                    }


                    const response =
                        await fetch(
                            "https://api.printify.com/v1/shops.json",
                            {
                                method: "GET",

                                headers: {
                                    "Authorization":
                                        `Bearer ${env.PRINTIFY_API_TOKEN}`,

                                    "Content-Type":
                                        "application/json"
                                }
                            }
                        );


                    const data =
                        await response.json();


                    if (!response.ok) {

                        console.error(
                            "PRINTIFY SHOP API error:",
                            data
                        );


                        return json({

                            success: false,

                            status:
                                response.status,

                            error:
                                data

                        }, response.status);

                    }


                    return json({

                        success: true,

                        shops:
                            data

                    });

                } catch (error) {

                    console.error(
                        "PRINTIFY SHOP DEBUG error:",
                        error
                    );


                    return json({

                        success: false,

                        error:
                            error?.message ||
                            String(error)

                    }, 500);

                }

            }

            /* =====================================================
            PRINTIFY PRODUCTS DEBUG
            ===================================================== */

            if (
                pathname === "/api/debug-printify-products" &&
                method === "GET"
            ) {

                try {

                    if (!env.PRINTIFY_API_TOKEN) {

                        return errorResponse(
                            "PRINTIFY_API_TOKEN is not configured.",
                            500
                        );

                    }


                    const shopId =
                        "28689890";


                    const response =
                        await fetch(
                            `https://api.printify.com/v1/shops/${shopId}/products.json`,
                            {
                                method: "GET",

                                headers: {
                                    "Authorization":
                                        `Bearer ${env.PRINTIFY_API_TOKEN}`,

                                    "Content-Type":
                                        "application/json"
                                }
                            }
                        );


                    const data =
                        await response.json();


                    if (!response.ok) {

                        console.error(
                            "PRINTIFY PRODUCTS API error:",
                            data
                        );


                        return json({

                            success: false,

                            status:
                                response.status,

                            error:
                                data

                        }, response.status);

                    }


                    return json({

                        success: true,

                        shop_id:
                            shopId,

                        data

                    });

                } catch (error) {

                    console.error(
                        "PRINTIFY PRODUCTS DEBUG error:",
                        error
                    );


                    return json({

                        success: false,

                        error:
                            error?.message ||
                            String(error)

                    }, 500);

                }

            }

            /* =====================================================
            DEBUG PRINTIFY
            ===================================================== */

            if (
                pathname === "/api/debug-printify" &&
                method === "GET"
            ) {

                return json({

                    success: true,

                    shopId:
                        env.PRINTIFY_SHOP_ID
                            ? String(env.PRINTIFY_SHOP_ID)
                            : null,

                    tokenExists:
                        !!env.PRINTIFY_API_TOKEN,

                    tokenLength:
                        env.PRINTIFY_API_TOKEN
                            ? env.PRINTIFY_API_TOKEN.length
                            : 0

                });

            }

            /* =====================================================
            PRINTIFY GET PRODUCTS
            ===================================================== */

            if (
                pathname === "/api/printify/products" &&
                method === "GET"
            ) {

                try {

                    if (!env.PRINTIFY_API_TOKEN) {

                        return errorResponse(
                            "Printify API token is not configured.",
                            500
                        );

                    }

                    if (!env.PRINTIFY_SHOP_ID) {

                        return errorResponse(
                            "Printify shop ID is not configured.",
                            500
                        );

                    }


                    const printifyUrl =
                        `https://api.printify.com/v1/shops/${env.PRINTIFY_SHOP_ID}/products.json`;


                    const response =
                        await fetch(
                            printifyUrl,
                            {
                                method: "GET",

                                headers: {

                                    "Authorization":
                                        `Bearer ${env.PRINTIFY_API_TOKEN}`,

                                    "Content-Type":
                                        "application/json"

                                }
                            }
                        );


                    const data =
                        await response.json();


                    if (!response.ok) {

                        console.error(
                            "PRINTIFY GET PRODUCTS error:",
                            data
                        );

                        return json({

                            success: false,

                            error:
                                "Printify API request failed.",

                            printify_status:
                                response.status,

                            details:
                                data

                        }, response.status);

                    }


                    return json({

                        success: true,

                        shop_id:
                            String(
                                env.PRINTIFY_SHOP_ID
                            ),

                        data

                    });


                } catch (error) {

                    console.error(
                        "PRINTIFY GET PRODUCTS exception:",
                        error
                    );


                    return errorResponse(
                        "Unable to connect to Printify.",
                        500
                    );

                }

            }

            /* =====================================================
            ADMIN SYNC ONE PRINTIFY PRODUCT
            ===================================================== */

            const adminPrintifySyncMatch =
                pathname.match(
                    /^\/api\/admin\/printify\/products\/([^/]+)\/sync$/
                );


            if (
                adminPrintifySyncMatch &&
                method === "POST"
            ) {

                const printifyProductId =
                    decodeURIComponent(
                        adminPrintifySyncMatch[1]
                    );


                try {

                    /* =============================================
                    VALIDATE PRINTIFY CONFIG
                    ============================================= */

                    if (!env.PRINTIFY_API_TOKEN) {

                        return errorResponse(
                            "Printify API token is not configured.",
                            500
                        );

                    }


                    if (!env.PRINTIFY_SHOP_ID) {

                        return errorResponse(
                            "Printify shop ID is not configured.",
                            500
                        );

                    }



                    /* =============================================
                    GET PRODUCT FROM PRINTIFY
                    ============================================= */

                    const printifyUrl =
                        `https://api.printify.com/v1/shops/${env.PRINTIFY_SHOP_ID}/products/${encodeURIComponent(printifyProductId)}.json`;


                    const response =
                        await fetch(
                            printifyUrl,
                            {

                                method:
                                    "GET",

                                headers: {

                                    "Authorization":
                                        `Bearer ${env.PRINTIFY_API_TOKEN}`,

                                    "Content-Type":
                                        "application/json"

                                }

                            }
                        );


                    const printifyProduct =
                        await response.json();


                    if (!response.ok) {

                        console.error(
                            "PRINTIFY SYNC GET PRODUCT error:",
                            printifyProduct
                        );


                        return json({

                            success:
                                false,

                            error:
                                "Failed to get product from Printify.",

                            printify_status:
                                response.status,

                            details:
                                printifyProduct

                        }, response.status);

                    }



                    /* =============================================
                    BASIC PRODUCT DATA
                    ============================================= */

                    const name =
                        normalizeString(
                            printifyProduct.title,
                            200
                        );


                    if (!name) {

                        return errorResponse(
                            "Printify product has no title.",
                            400
                        );

                    }


                    const description =
                        normalizeString(
                            printifyProduct.description,
                            10000
                        );


                    /* =============================================
                    PRODUCT IMAGE
                    ============================================= */

                    const images =
                        Array.isArray(
                            printifyProduct.images
                        )
                            ? printifyProduct.images
                            : [];


                    const defaultImage =
                        images.find(
                            image =>
                                image?.is_default &&
                                isValidImageUrl(
                                    image?.src
                                )
                        );


                    const firstValidImage =
                        images.find(
                            image =>
                                isValidImageUrl(
                                    image?.src
                                )
                        );


                    const productImage =
                        defaultImage?.src ||
                        firstValidImage?.src ||
                        null;



                    if (!productImage) {

                        return errorResponse(
                            "Printify product has no valid image.",
                            400
                        );

                    }



                    /* =============================================
                    CATEGORY
                    ============================================= */

                    /*
                    * Printify does not necessarily provide
                    * our exact store category.
                    *
                    * Use the existing product category
                    * when updating an existing product.
                    *
                    * For a new product use "t-shirts".
                    */

                    let category =
                        "t-shirts";



                    /* =============================================
                    EXISTING PRODUCT
                    ============================================= */

                    const existingProduct =
                        await env.DB
                            .prepare(`

                                SELECT

                                    id,

                                    category,

                                    slug

                                FROM products

                                WHERE printify_product_id = ?

                            `)
                            .bind(
                                printifyProductId
                            )
                            .first();


                    if (
                        existingProduct?.category
                    ) {

                        category =
                            existingProduct.category;

                    }



                    /* =============================================
                    SLUG
                    ============================================= */

                    function makeSlug(value) {

                        return String(
                            value || ""
                        )
                            .toLowerCase()
                            .trim()
                            .replace(
                                /['’]/g,
                                ""
                            )
                            .replace(
                                /[^a-z0-9]+/g,
                                "-"
                            )
                            .replace(
                                /^-+|-+$/g,
                                ""
                            )
                            .slice(
                                0,
                                150
                            );

                    }


                    let slug =
                        existingProduct?.slug ||
                        makeSlug(name);


                    if (!slug) {

                        slug =
                            "product-" +
                            String(
                                printifyProductId
                            ).slice(
                                0,
                                12
                            );

                    }



                    /* =============================================
                    COLORS + SIZES
                    ============================================= */

                    const printifyOptions =
                        Array.isArray(
                            printifyProduct.options
                        )
                            ? printifyProduct.options
                            : [];


                    const colorOption =
                        printifyOptions.find(
                            option =>
                                String(
                                    option?.type || ""
                                ).toLowerCase() === "color"
                        );


                    const sizeOption =
                        printifyOptions.find(
                            option =>
                                String(
                                    option?.type || ""
                                ).toLowerCase() === "size"
                        );


                    const colorValues =
                        Array.isArray(
                            colorOption?.values
                        )
                            ? colorOption.values
                            : [];


                    const sizeValues =
                        Array.isArray(
                            sizeOption?.values
                        )
                            ? sizeOption.values
                            : [];



                    /* =============================================
                    MAP PRINTIFY OPTION IDs
                    ============================================= */

                    const colorMap =
                        new Map();


                    for (
                        const color
                        of colorValues
                    ) {

                        colorMap.set(
                            Number(
                                color.id
                            ),
                            {

                                name:
                                    String(
                                        color.title || ""
                                    ).trim(),

                                hex:
                                    Array.isArray(
                                        color.colors
                                    ) &&
                                    color.colors[0]
                                        ? color.colors[0]
                                        : null

                            }
                        );

                    }


                    const sizeMap =
                        new Map();


                    for (
                        const size
                        of sizeValues
                    ) {

                        sizeMap.set(
                            Number(
                                size.id
                            ),
                            String(
                                size.title || ""
                            ).trim()
                        );

                    }



                    /* =============================================
                    VALID VARIANTS
                    ============================================= */

                    const printifyVariants =
                        Array.isArray(
                            printifyProduct.variants
                        )
                            ? printifyProduct.variants
                            : [];


                    const validVariants =
                        printifyVariants.filter(
                            variant =>
                                variant &&
                                variant.is_enabled !== false &&
                                variant.is_available !== false
                        );


                    if (!validVariants.length) {

                        return errorResponse(
                            "Printify product has no available variants.",
                            400
                        );

                    }



                    /* =============================================
                    BUILD VARIANT MATRIX
                    ============================================= */

                    const variantRows =
                        [];


                    for (
                        const variant
                        of validVariants
                    ) {

                        const optionIds =
                            Array.isArray(
                                variant.options
                            )
                                ? variant.options
                                : [];


                        let color =
                            null;


                        let size =
                            null;


                        for (
                            const optionId
                            of optionIds
                        ) {

                            const numericId =
                                Number(
                                    optionId
                                );


                            if (
                                colorMap.has(
                                    numericId
                                )
                            ) {

                                color =
                                    colorMap.get(
                                        numericId
                                    );

                            }


                            if (
                                sizeMap.has(
                                    numericId
                                )
                            ) {

                                size =
                                    sizeMap.get(
                                        numericId
                                    );

                            }

                        }



                        /*
                        * Some Printify products may have
                        * unusual option structures.
                        *
                        * In that case fall back to the
                        * variant title.
                        */

                        if (
                            !color ||
                            !size
                        ) {

                            const titleParts =
                                String(
                                    variant.title || ""
                                )
                                    .split(
                                        " / "
                                    )
                                    .map(
                                        value =>
                                            value.trim()
                                    );


                            if (!size) {

                                size =
                                    titleParts.find(
                                        part =>
                                            sizeValues.some(
                                                item =>
                                                    String(
                                                        item.title
                                                    ).trim()
                                                    .toUpperCase() ===
                                                    part.toUpperCase()
                                            )
                                    ) ||
                                    null;

                            }


                            if (!color) {

                                const possibleColor =
                                    titleParts.find(
                                        part =>
                                            colorValues.some(
                                                item =>
                                                    String(
                                                        item.title
                                                    ).trim()
                                                    .toLowerCase() ===
                                                    part.toLowerCase()
                                            )
                                    );


                                if (
                                    possibleColor
                                ) {

                                    const matchingColor =
                                        colorValues.find(
                                            item =>
                                                String(
                                                    item.title
                                                ).trim()
                                                .toLowerCase() ===
                                                possibleColor.toLowerCase()
                                        );


                                    color = {

                                        name:
                                            String(
                                                matchingColor?.title ||
                                                possibleColor
                                            ).trim(),

                                        hex:
                                            Array.isArray(
                                                matchingColor?.colors
                                            ) &&
                                            matchingColor.colors[0]
                                                ? matchingColor.colors[0]
                                                : null

                                    };

                                }

                            }

                        }


                        /*
                        * We need both color and size
                        * for Threadly's current variant model.
                        */

                        if (
                            !color ||
                            !color.name ||
                            !size
                        ) {

                            console.warn(
                                "Skipping unmappable Printify variant:",
                                variant
                            );

                            continue;

                        }



                        /* =========================================
                        VARIANT IMAGE
                        ========================================= */

                        const variantImage =
                            images.find(
                                image =>

                                    Array.isArray(
                                        image?.variant_ids
                                    ) &&

                                    image.variant_ids.some(
                                        id =>
                                            String(id) ===
                                            String(variant.id)
                                    ) &&

                                    isValidImageUrl(
                                        image?.src
                                    )
                            );


                        const image =
                            variantImage?.src ||
                            productImage;



                        /* =========================================
                        ADD VARIANT
                        ========================================= */

                        variantRows.push({

                            colorName:
                                color.name,

                            colorHex:
                                color.hex,

                            size,

                            image,

                            printifyVariantId:
                                String(
                                    variant.id
                                ),

                            status:
                                "active"

                        });

                    }



                    if (!variantRows.length) {

                        return errorResponse(
                            "Unable to map any Printify variants to color/size.",
                            400
                        );

                    }



                    /* =============================================
                    UNIQUE COLORS
                    ============================================= */

                    const uniqueColors =
                        new Map();


                    for (
                        const row
                        of variantRows
                    ) {

                        const key =
                            row.colorName
                                .toLowerCase();


                        if (
                            !uniqueColors.has(
                                key
                            )
                        ) {

                            uniqueColors.set(
                                key,
                                {

                                    name:
                                        row.colorName,

                                    hex:
                                        row.colorHex,

                                    image:
                                        row.image

                                }
                            );

                        }

                    }



                    /* =============================================
                    UNIQUE SIZES
                    ============================================= */

                    const uniqueSizes =
                        [];


                    const sizeSet =
                        new Set();


                    for (
                        const row
                        of variantRows
                    ) {

                        const key =
                            row.size
                                .toUpperCase();


                        if (
                            !sizeSet.has(
                                key
                            )
                        ) {

                            sizeSet.add(
                                key
                            );

                            uniqueSizes.push(
                                row.size
                            );

                        }

                    }

                    /* =============================================
                    PRODUCT PRICE
                    ============================================= */

                    /*
                    * Printify "price" is stored in cents.
                    *
                    * Threadly currently stores the
                    * customer selling price in dollars.
                    *
                    * We therefore use the existing price
                    * when updating an existing product.
                    *
                    * For a new product use the first
                    * Printify variant price as a temporary
                    * fallback.
                    */

                    let price =
                        existingProduct
                            ? null
                            : null;


                    if (
                        existingProduct
                    ) {

                        const currentPrice =
                            await env.DB
                                .prepare(`

                                    SELECT price

                                    FROM products

                                    WHERE id = ?

                                `)
                                .bind(
                                    existingProduct.id
                                )
                                .first();


                        price =
                            Number(
                                currentPrice?.price || 0
                            );

                    }


                    if (
                        !Number.isFinite(price) ||
                        price <= 0
                    ) {

                        const firstVariant =
                            validVariants[0];


                        price =
                            Number(
                                firstVariant?.price || 0
                            ) / 100;


                        /*
                        * Temporary fallback.
                        * Add your actual retail markup
                        * before selling publicly.
                        */

                        price =
                            Number(
                                price.toFixed(2)
                            );

                    }



                    /* =============================================
                    UPSERT PRODUCT
                    ============================================= */

                    let productId;


                    if (
                        existingProduct
                    ) {

                        productId =
                            existingProduct.id;


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

                                    status = 'active'

                                WHERE id = ?

                            `)
                            .bind(

                                name,

                                slug,

                                description,

                                price,

                                productImage,

                                category,

                                printifyProductId,

                                productId

                            )
                            .run();

                    } else {

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

                                    VALUES (

                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        'active'

                                    )

                                `)
                                .bind(

                                    name,

                                    slug,

                                    description,

                                    price,

                                    productImage,

                                    category,

                                    printifyProductId

                                )
                                .run();


                        productId =
                            result.meta
                                ?.last_row_id;


                        if (!productId) {

                            throw new Error(
                                "Unable to create product in D1."
                            );

                        }

                    }



                    /* =============================================
                    READ OLD VARIANTS
                    ============================================= */

                    const oldVariants =
                        await getProductVariants(
                            productId,
                            env
                        );


                    const oldMap =
                        new Map();


                    for (
                        const variant
                        of oldVariants
                    ) {

                        const key =
                            `${String(
                                variant.color_name
                            ).toLowerCase()}::${String(
                                variant.size
                            ).toUpperCase()}`;


                        oldMap.set(
                            key,
                            variant
                        );

                    }



                    /* =============================================
                    DELETE CURRENT VARIANTS
                    ============================================= */

                    await env.DB
                        .prepare(`

                            DELETE FROM product_variants

                            WHERE product_id = ?

                        `)
                        .bind(
                            productId
                        )
                        .run();



                    /* =============================================
                    INSERT PRINTIFY VARIANTS
                    ============================================= */

                    let insertedVariants =
                        0;


                    for (
                        const row
                        of variantRows
                    ) {

                        const key =
                            `${row.colorName.toLowerCase()}::${row.size.toUpperCase()}`;


                        const oldVariant =
                            oldMap.get(
                                key
                            );


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

                                VALUES (

                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?

                                )

                            `)
                            .bind(

                                productId,

                                row.colorName,

                                row.colorHex ||
                                    null,

                                row.size,

                                row.image ||
                                    productImage,

                                row.printifyVariantId,

                                row.status

                            )
                            .run();


                        insertedVariants++;

                    }



                    /* =============================================
                    GET FINAL PRODUCT
                    ============================================= */

                    const finalProduct =
                        await getProductWithVariants(
                            productId,
                            env
                        );


                    return json({

                        success:
                            true,

                        message:
                            "Printify product synced successfully.",

                        printify_product_id:
                            printifyProductId,

                        product_id:
                            productId,

                        product: {

                            id:
                                finalProduct?.id,

                            name:
                                finalProduct?.name,

                            slug:
                                finalProduct?.slug,

                            price:
                                finalProduct?.price,

                            image:
                                finalProduct?.image,

                            category:
                                finalProduct?.category,

                            status:
                                finalProduct?.status,

                            printify_product_id:
                                finalProduct?.printify_product_id

                        },

                        sync: {

                            colors:
                                uniqueColors.size,

                            sizes:
                                uniqueSizes.length,

                            variants:
                                insertedVariants

                        }

                    });


                } catch (error) {

                    console.error(
                        "ADMIN PRINTIFY SYNC error:",
                        error
                    );


                    return json({

                        success:
                            false,

                        error:
                            "Failed to sync Printify product.",

                        debug:
                            error?.message ||
                            String(error)

                    }, 500);

                }

            }

            /* =====================================================
            ADMIN SYNC ALL PRINTIFY PRODUCTS
            ===================================================== */

            if (
                pathname === "/api/admin/printify/sync" &&
                method === "POST"
            ) {
                try {
                    /* =============================================
                    VALIDATE PRINTIFY CONFIG
                    ============================================= */

                    if (!env.PRINTIFY_API_TOKEN) {
                        return errorResponse(
                            "Printify API token is not configured.",
                            500
                        );
                    }

                    if (!env.PRINTIFY_SHOP_ID) {
                        return errorResponse(
                            "Printify shop ID is not configured.",
                            500
                        );
                    }

                    /* =============================================
                    GET ALL PRODUCTS FROM PRINTIFY
                    ============================================= */

                    const printifyUrl =
                        `https://api.printify.com/v1/shops/${env.PRINTIFY_SHOP_ID}/products.json`;

                    const response =
                        await fetch(
                            printifyUrl,
                            {
                                method: "GET",
                                headers: {
                                    "Authorization":
                                        `Bearer ${env.PRINTIFY_API_TOKEN}`,

                                    "Content-Type":
                                        "application/json"
                                }
                            }
                        );


                    const data =
                        await response.json();


                    if (!response.ok) {
                        console.error(
                            "PRINTIFY SYNC ALL GET PRODUCTS error:",
                            data
                        );

                        return json({
                            success: false,
                            error:
                                "Failed to get products from Printify.",
                            printify_status:
                                response.status,
                            details:
                                data
                        }, response.status);
                    }


                    /* =============================================
                    EXTRACT PRODUCTS
                    ============================================= */

                    const products =
                        Array.isArray(data?.data)
                            ? data.data
                            : [];


                    if (!products.length) {
                        return json({
                            success: true,
                            message:
                                "No Printify products found.",
                            synced: 0,
                            failed: 0,
                            total: 0,
                            results: []
                        });
                    }


                    /* =============================================
                    SYNC PRODUCTS ONE BY ONE
                    ============================================= */

                    const results = [];

                    let synced = 0;
                    let failed = 0;


                    for (
                        const printifyProduct of products
                    ) {

                        const printifyProductId =
                            printifyProduct?.id;


                        if (!printifyProductId) {

                            failed++;

                            results.push({
                                success: false,
                                error:
                                    "Printify product has no ID."
                            });

                            continue;
                        }


                        try {

                            /* =====================================
                            GET FULL PRODUCT
                            ===================================== */

                            const productResponse =
                                await fetch(
                                    `https://api.printify.com/v1/shops/${env.PRINTIFY_SHOP_ID}/products/${encodeURIComponent(printifyProductId)}.json`,
                                    {
                                        method: "GET",
                                        headers: {
                                            "Authorization":
                                                `Bearer ${env.PRINTIFY_API_TOKEN}`,

                                            "Content-Type":
                                                "application/json"
                                        }
                                    }
                                );


                            const fullProduct =
                                await productResponse.json();


                            if (!productResponse.ok) {

                                throw new Error(
                                    `Printify returned ${productResponse.status}`
                                );
                            }


                            /* =====================================
                            BASIC PRODUCT DATA
                            ===================================== */

                            const name =
                                normalizeString(
                                    fullProduct.title,
                                    200
                                );


                            if (!name) {
                                throw new Error(
                                    "Printify product has no title."
                                );
                            }


                            const description =
                                normalizeString(
                                    fullProduct.description,
                                    10000
                                );


                            /* =====================================
                            PRODUCT IMAGE
                            ===================================== */

                            const images =
                                Array.isArray(
                                    fullProduct.images
                                )
                                    ? fullProduct.images
                                    : [];


                            const defaultImage =
                                images.find(
                                    image =>
                                        image?.is_default &&
                                        isValidImageUrl(
                                            image?.src
                                        )
                                );


                            const firstValidImage =
                                images.find(
                                    image =>
                                        isValidImageUrl(
                                            image?.src
                                        )
                                );


                            const productImage =
                                defaultImage?.src ||
                                firstValidImage?.src ||
                                null;


                            if (!productImage) {
                                throw new Error(
                                    "Printify product has no valid image."
                                );
                            }


                            /* =====================================
                            EXISTING PRODUCT
                            ===================================== */

                            const existingProduct =
                                await env.DB
                                    .prepare(`
                                        SELECT
                                            id,
                                            category,
                                            slug,
                                            price
                                        FROM products
                                        WHERE printify_product_id = ?
                                    `)
                                    .bind(
                                        String(printifyProductId)
                                    )
                                    .first();


                            /* =====================================
                            CATEGORY
                            ===================================== */

                            let category =
                                "t-shirts";


                            if (
                                existingProduct?.category
                            ) {
                                category =
                                    existingProduct.category;
                            }


                            /* =====================================
                            SLUG
                            ===================================== */

                            function makeSlug(value) {

                                return String(
                                    value || ""
                                )
                                    .toLowerCase()
                                    .trim()
                                    .replace(
                                        /['’]/g,
                                        ""
                                    )
                                    .replace(
                                        /[^a-z0-9]+/g,
                                        "-"
                                    )
                                    .replace(
                                        /^-+|-+$/g,
                                        ""
                                    )
                                    .slice(
                                        0,
                                        150
                                    );
                            }


                            let slug =
                                existingProduct?.slug ||
                                makeSlug(name);


                            if (!slug) {
                                slug =
                                    "product-" +
                                    String(
                                        printifyProductId
                                    ).slice(
                                        0,
                                        12
                                    );
                            }


                            /* =====================================
                            PRICE
                            ===================================== */

                            let price =
                                Number(
                                    existingProduct?.price || 0
                                );


                            if (
                                !Number.isFinite(price) ||
                                price <= 0
                            ) {

                                const firstVariant =
                                    Array.isArray(
                                        fullProduct.variants
                                    )
                                        ? fullProduct.variants[0]
                                        : null;


                                price =
                                    Number(
                                        firstVariant?.price || 0
                                    ) / 100;


                                price =
                                    Number(
                                        price.toFixed(2)
                                    );
                            }


                            /* =====================================
                            UPSERT PRODUCT
                            ===================================== */

                            let productId;


                            if (existingProduct) {

                                productId =
                                    existingProduct.id;


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
                                            status = 'active'
                                        WHERE id = ?
                                    `)
                                    .bind(
                                        name,
                                        slug,
                                        description,
                                        price,
                                        productImage,
                                        category,
                                        String(
                                            printifyProductId
                                        ),
                                        productId
                                    )
                                    .run();

                            } else {

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
                                            VALUES (
                                                ?,
                                                ?,
                                                ?,
                                                ?,
                                                ?,
                                                ?,
                                                ?,
                                                'active'
                                            )
                                        `)
                                        .bind(
                                            name,
                                            slug,
                                            description,
                                            price,
                                            productImage,
                                            category,
                                            String(
                                                printifyProductId
                                            )
                                        )
                                        .run();


                                productId =
                                    result.meta
                                        ?.last_row_id;


                                if (!productId) {
                                    throw new Error(
                                        "Unable to create product in D1."
                                    );
                                }
                            }


                            /* =====================================
                            OPTIONS
                            ===================================== */

                            const printifyOptions =
                                Array.isArray(
                                    fullProduct.options
                                )
                                    ? fullProduct.options
                                    : [];


                            const colorOption =
                                printifyOptions.find(
                                    option =>
                                        String(
                                            option?.type || ""
                                        ).toLowerCase() ===
                                        "color"
                                );


                            const sizeOption =
                                printifyOptions.find(
                                    option =>
                                        String(
                                            option?.type || ""
                                        ).toLowerCase() ===
                                        "size"
                                );


                            const colorValues =
                                Array.isArray(
                                    colorOption?.values
                                )
                                    ? colorOption.values
                                    : [];


                            const sizeValues =
                                Array.isArray(
                                    sizeOption?.values
                                )
                                    ? sizeOption.values
                                    : [];


                            /* =====================================
                            MAP COLORS
                            ===================================== */

                            const colorMap =
                                new Map();


                            for (
                                const color
                                of colorValues
                            ) {

                                colorMap.set(
                                    Number(
                                        color.id
                                    ),
                                    {
                                        name:
                                            String(
                                                color.title || ""
                                            ).trim(),

                                        hex:
                                            Array.isArray(
                                                color.colors
                                            ) &&
                                            color.colors[0]
                                                ? color.colors[0]
                                                : null
                                    }
                                );
                            }


                            /* =====================================
                            MAP SIZES
                            ===================================== */

                            const sizeMap =
                                new Map();


                            for (
                                const size
                                of sizeValues
                            ) {

                                sizeMap.set(
                                    Number(
                                        size.id
                                    ),
                                    String(
                                        size.title || ""
                                    ).trim()
                                );
                            }


                            /* =====================================
                            VALID VARIANTS
                            ===================================== */

                            const printifyVariants =
                                Array.isArray(
                                    fullProduct.variants
                                )
                                    ? fullProduct.variants
                                    : [];


                            const validVariants =
                                printifyVariants.filter(
                                    variant =>
                                        variant &&
                                        variant.is_enabled !== false &&
                                        variant.is_available !== false
                                );


                            if (!validVariants.length) {
                                throw new Error(
                                    "Printify product has no available variants."
                                );
                            }


                            /* =====================================
                            BUILD VARIANT ROWS
                            ===================================== */

                            const variantRows =
                                [];


                            for (
                                const variant
                                of validVariants
                            ) {

                                const optionIds =
                                    Array.isArray(
                                        variant.options
                                    )
                                        ? variant.options
                                        : [];


                                let color =
                                    null;


                                let size =
                                    null;


                                for (
                                    const optionId
                                    of optionIds
                                ) {

                                    const numericId =
                                        Number(
                                            optionId
                                        );


                                    if (
                                        colorMap.has(
                                            numericId
                                        )
                                    ) {

                                        color =
                                            colorMap.get(
                                                numericId
                                            );
                                    }


                                    if (
                                        sizeMap.has(
                                            numericId
                                        )
                                    ) {

                                        size =
                                            sizeMap.get(
                                                numericId
                                            );
                                    }
                                }


                                /* =================================
                                FALLBACK VARIANT TITLE
                                ================================= */

                                if (
                                    !color ||
                                    !size
                                ) {

                                    const titleParts =
                                        String(
                                            variant.title || ""
                                        )
                                            .split(
                                                " / "
                                            )
                                            .map(
                                                value =>
                                                    value.trim()
                                            );


                                    if (!size) {

                                        size =
                                            titleParts.find(
                                                part =>
                                                    sizeValues.some(
                                                        item =>
                                                            String(
                                                                item.title
                                                            )
                                                                .trim()
                                                                .toUpperCase() ===
                                                            part.toUpperCase()
                                                    )
                                            ) ||
                                            null;
                                    }


                                    if (!color) {

                                        const possibleColor =
                                            titleParts.find(
                                                part =>
                                                    colorValues.some(
                                                        item =>
                                                            String(
                                                                item.title
                                                            )
                                                                .trim()
                                                                .toLowerCase() ===
                                                            part.toLowerCase()
                                                    )
                                            );


                                        if (
                                            possibleColor
                                        ) {

                                            const matchingColor =
                                                colorValues.find(
                                                    item =>
                                                        String(
                                                            item.title
                                                        )
                                                            .trim()
                                                            .toLowerCase() ===
                                                        possibleColor.toLowerCase()
                                                );


                                            color = {

                                                name:
                                                    String(
                                                        matchingColor?.title ||
                                                        possibleColor
                                                    ).trim(),

                                                hex:
                                                    Array.isArray(
                                                        matchingColor?.colors
                                                    ) &&
                                                    matchingColor.colors[0]
                                                        ? matchingColor.colors[0]
                                                        : null
                                            };
                                        }
                                    }
                                }


                                if (
                                    !color ||
                                    !color.name ||
                                    !size
                                ) {

                                    console.warn(
                                        "Skipping unmappable Printify variant:",
                                        variant
                                    );

                                    continue;
                                }


                                /* =================================
                                VARIANT IMAGE
                                ================================= */

                                const variantImage =
                                    images.find(
                                        image =>
                                            Array.isArray(
                                                image?.variant_ids
                                            ) &&
                                            image.variant_ids.some(
                                                id =>
                                                    String(id) ===
                                                    String(variant.id)
                                            ) &&
                                            isValidImageUrl(
                                                image?.src
                                            )
                                    );


                                const image =
                                    variantImage?.src ||
                                    productImage;


                                variantRows.push({

                                    colorName:
                                        color.name,

                                    colorHex:
                                        color.hex,

                                    size,

                                    image,

                                    printifyVariantId:
                                        String(
                                            variant.id
                                        ),

                                    status:
                                        "active"
                                });
                            }


                            if (!variantRows.length) {
                                throw new Error(
                                    "Unable to map any Printify variants to color/size."
                                );
                            }


                            /* =====================================
                            DELETE OLD VARIANTS
                            ===================================== */

                            await env.DB
                                .prepare(`
                                    DELETE FROM product_variants
                                    WHERE product_id = ?
                                `)
                                .bind(
                                    productId
                                )
                                .run();


                            /* =====================================
                            INSERT VARIANTS
                            ===================================== */

                            let insertedVariants =
                                0;


                            for (
                                const row
                                of variantRows
                            ) {

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
                                        VALUES (
                                            ?,
                                            ?,
                                            ?,
                                            ?,
                                            ?,
                                            ?,
                                            ?
                                        )
                                    `)
                                    .bind(
                                        productId,
                                        row.colorName,
                                        row.colorHex ||
                                            null,
                                        row.size,
                                        row.image ||
                                            productImage,
                                        row.printifyVariantId,
                                        row.status
                                    )
                                    .run();


                                insertedVariants++;
                            }


                            /* =====================================
                            SUCCESS
                            ===================================== */

                            synced++;


                            results.push({

                                success:
                                    true,

                                printify_product_id:
                                    String(
                                        printifyProductId
                                    ),

                                product_id:
                                    productId,

                                name,

                                variants:
                                    insertedVariants
                            });


                        } catch (productError) {

                            failed++;


                            console.error(
                                "SYNC ALL PRODUCT error:",
                                printifyProductId,
                                productError
                            );


                            results.push({

                                success:
                                    false,

                                printify_product_id:
                                    String(
                                        printifyProductId
                                    ),

                                error:
                                    productError?.message ||
                                    String(
                                        productError
                                    )
                            });
                        }
                    }


                    /* =============================================
                    FINAL RESPONSE
                    ============================================= */

                    return json({

                        success:
                            true,

                        message:
                            "Printify products synced.",

                        total:
                            products.length,

                        synced,

                        failed,

                        results
                    });


                } catch (error) {

                    console.error(
                        "ADMIN PRINTIFY SYNC ALL error:",
                        error
                    );


                    return json({

                        success:
                            false,

                        error:
                            "Failed to sync all Printify products.",

                        debug:
                            error?.message ||
                            String(
                                error
                            )

                    }, 500);
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
