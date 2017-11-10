var IapppayController = require('../controllers/iapppay.server.controller');

module.exports = function (app) {
  app.route('/pay/iapppay/getPayPage')
    .get(IapppayController.getPayPage);

  app.route('/pay/iapppay/payResult')
    .post(IapppayController.payResult);
}