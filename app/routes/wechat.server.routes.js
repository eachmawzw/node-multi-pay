var WechatController = require('../controllers/wechat.server.controller');

module.exports = function (app) {
  app.route('/api/getOAuthAccessToken')
    .get(WechatController.getOAuthAccessToken);

  app.route('/api/refreshOAuthAccessToken')
    .get(WechatController.refreshOAuthAccessToken);

  app.route('/api/wechatPay')
    .get(WechatController.wechatPay);

  app.route('/api/wechatConfig')
    .get(WechatController.wechatConfig);

  app.route('/api/payResult')
  .post(WechatController.payResult);
}