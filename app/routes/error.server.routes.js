module.exports = function (app) {
  app.use(function (req, res, next) {
    res.status(404);
    try {
      return res.json({code: 404, status: '页面不存在！'});
      return next();
    } catch (err) {
      console.error('404 set header before catch, error:', err);
    } 
  });

  app.use(function (err, req, res, next) {
    res.status(500);
    try {
      return res.json({code: 500, msg: '服务器异常！'});
      return next();
    } catch (err) {
      console.error('500 set header before catch, error:', err);
    }
  });
}