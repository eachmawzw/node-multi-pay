var WechatController = require('../controllers/wechat.server.controller');

module.exports = function (app) {
  app.route('/pay/wxapi/getOAuthAccessToken')
    .get(WechatController.getOAuthAccessToken);

  app.route('/pay/wxapi/refreshOAuthAccessToken')
    .get(WechatController.refreshOAuthAccessToken);

  app.route('/pay/wxapi/wechatPay')
    .get(WechatController.wechatPay);

  app.route('/pay/wxapi/wechatConfig')
    .get(WechatController.wechatConfig);

  app.route('/pay/wxapi/payResult')
  .post(WechatController.payResult);
}