var AlipayController = require('../controllers/alipay.server.controller');

module.exports = function (app) {
  app.route('/pay/alipay/getPayPage')
    .get(AlipayController.getPayPage);

  app.route('/pay/alipay/payResult')
    .post(AlipayController.payResult);
}