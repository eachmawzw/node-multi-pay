var http = require('request');
var crypto = require('crypto');
var fs = require('fs');

var utils = require('../lib/utils');

const APPID = '';                                        // 蚂蚁金服分配的应用ID
const RETURNURL = 'https://xxx.xxx.com/xxx';             // 支付后前端页面的跳转地址
const NOTIFYURL = 'https://xxx.xxx.com/pay/alipay/payResult';// 支付成功后支付宝通知商户的接口地址
// 签名算法要在字符串中带上这样的头和尾 
// -----BEGIN RSA PRIVATE KEY-----  为PKCS1私钥
// -----BEGIN RSA KEY-----  为PKCS8私钥
// 其实PKCS8和PKCS1都是可以互换的，都有工具，支付宝平台也提供了
// 在node中，fs需要读取的是pem文件，所以需要私钥和公钥重新组装一下，lib文件夹下提供了格式，打开文件可以看到
// 使用fs模块读入pem文件
const privateKey = fs.readFileSync( './app/lib/base_private_key.pem', 'utf-8');
// 一定要注意异步通知的验签是使用支付宝的公钥！！！而不是自己的公钥！！！
// 踩这个坑踩了两天！！！！牢记！！！！
const publicKey = fs.readFileSync('./app/lib/alipay_public_key.pem', 'utf-8');

module.exports = {
  // 获取支付页面，该接口将返回一个页面给前端，唤起支付
  getPayPage: function (req, res, next) {
    var query = req.query;
    if (!query.outTradeNo || !query.totalAmount || !query.quitUrl || !query.psbParams) {
      res.json({code: 500, msg: '参数错误'});
      return;
    }

    var _biz_content = {
      body: '购买的物品介绍',
      subject: '物品标题',
      out_trade_no: query.outTradeNo,
      total_amount: query.totalAmount + '',
      product_code: 'QUICK_WAP_WAY',
      passback_params: encodeURIComponent(query.psbParams),
      quit_url: query.quitUrl
    }

    var params = {
      app_id: APPID,
      method: 'alipay.trade.wap.pay',
      return_url: query.quitUrl,
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: utils.getDateTime(Date.now()),
      version: '1.0',
      notify_url: NOTIFYURL,
      biz_content: JSON.stringify(_biz_content)
    }

    // sha256签名
    var sign = utils.createSignFunc(params, privateKey, 'RSA2');

    // 格式化对象
    var bodyStr = utils.serialize(params, true, 'encode');

    // 签名加入下单对象
    bodyStr += '&sign=' + sign;

    http({
      url: 'https://openapi.alipay.com/gateway.do?' + bodyStr,
      method: 'GET'
    }, function (err, response, body) {
      // 这里要特别注意获取的body并非我们想要的
      // 因为需要拿到这个接口重定向之后的地址
      return res.json({code: 200, data: {url: response.request.href}});
      return next();
    });

  },
  payResult: function (req, res, next) {
    // 获取支付宝回调参数列表
    var reqBody = req.body;

    try {
      var sign = reqBody.sign;
      var signType = reqBody.sign_type;

      // 定义签名参数
      var signObj = {}
      for (var param in reqBody) {
        if (param !== 'sign' && param !== 'sign_type') {
          signObj[param] = reqBody[param]
        }
      }

      // 获取验签结果
      var checkSign = utils.verifySignFunc(signObj, publicKey, signType, sign);

      if (!checkSign) {
        console.log('验签失败！');
        return res.send('签名错误！');
        return next();
      }

      // 1、商户需要验证该通知数据中的out_trade_no是否为商户系统中创建的订单号，
      // 2、判断total_amount是否确实为该订单的实际金额（即商户订单创建时的金额），
      // 3、校验通知中的seller_id（或者seller_email) 是否为out_trade_no这笔单据的对应的操作方（有的时候，一个商户可能有多个seller_id/seller_email），
      // 4、验证app_id是否为该商户本身。上述1、2、3、4有任何一个验证不通过，则表明本次通知是异常通知，务必忽略。在上述验证通过后商户必须根据支付宝不同类型的业务通知，正确的进行不同的业务处理，并且过滤重复的通知结果数据。在支付宝的业务通知中，只有交易通知状态为TRADE_SUCCESS或TRADE_FINISHED时，支付宝才会认定为买家付款成功。
      // 发起业务请求获取订单详情

      // TODO 处理业务逻辑
      // 处理完成后返回'success'，如果不返回该信息，则支付平台会重复相同的订单通知
      return res.send('success');
      return next();
    } catch (e) {
      console.error(e);
      return next();
    }
    
  }
}