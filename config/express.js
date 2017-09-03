var express = require('express');
var bodyParse = require('body-parser');
var xmlParser = require('express-xml-bodyparser');

module.exports = function () {
  console.log('express init...');
  var app = express();

  app.use(bodyParse.json());
  app.use(xmlParser());

  app.use(function (req, res, next) {
    /* 获取请求源 */
    var allowOrigin = req.headers.origin;
    /* 允许跨域 */
    res.header('Access-Control-Allow-Origin', allowOrigin);
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With, token');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200); // options请求快速返回
    } else {
      next(); 
    }
  });

  require('../app/routes/wechat.server.routes')(app);

  /* 错误路由拦截 */
  require('../app/routes/error.server.routes')(app);

  return app;
}