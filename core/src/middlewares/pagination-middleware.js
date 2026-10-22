// src/middlewares/pagination-middleware.js  (ต่อยอดจากสไลด์ Week-07 "Pagination Middleware")
// ใช้: app.use(queryParser())  <- ต้องมีวงเล็บ และต้องอยู่ "ก่อน" router
// OFFSET = (page - 1) * limit
export const queryParser = (defaultLimit = 10, maxLimit = 100) => {
    return (req, res, next) => {
        const query = req.query || {}
        let page = parseInt(query.page)
        let limit = parseInt(query.limit ?? query.pageSize ?? query.size)
        if (Number.isNaN(page)) page = 1
        if (Number.isNaN(limit)) limit = defaultLimit
        page = Math.max(page, 1)                         // page ติดลบ/0 -> 1
        limit = Math.min(Math.max(limit, 1), maxLimit)   // limit 1..maxLimit

        const offset = (page - 1) * limit
        req.pagination = {page, limit, offset}
        next()
    }
}
