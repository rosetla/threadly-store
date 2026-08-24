export async function onRequest(context) {
  try {
    const result = await context.env.DB
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
