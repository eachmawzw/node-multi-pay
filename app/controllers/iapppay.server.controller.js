var http = require('request');
var fs = require('fs');

const APPID = '';
const NOTIFYURL = 'https://xxx.xxx.com/pay/iapppay/payResult';

var utils = require('../lib/utils');

const privateKey = fs.readFileSync( './app/lib/base_private_key.pem', 'utf-8');
const publicKey = fs.readFileSync('./app/lib/iapppay_public_key.pem', 'utf-8');

// 下单API
var getOrderAPI = function (params, cb) {
  var order_data = {
    "appid": APPID,                          // 平台分配的应用编号
    "waresid": parseInt(params.waresId),     // 应用中的商品编号
    "waresname": params.waresName,           // 商品名称，对于消费型_应用传入价格的计费方式有效，如果不传则展示后台设置的商品名称
    "cporderid": params.cporderId,           // 商户生成的订单号，需要保证系统唯一
    "price": parseFloat(params.price),       // 支付金额，对于消费型_应用传入价格的计费方式有效，其它计费方式不需要传入本参数
    "currency": "RMB",                       // 货币类型以及单位：RMB – 人民币（单位：元）
    "appuserid": params.appuserId,           // 用户在商户应用的唯一标识，建议为用户帐号。对于游戏，需要区分到不同区服，#号分隔；比如游戏帐号abc在01区，则传入“abc#01”
    "cpprivateinfo": params.cpprivateInfo,   // 商户私有信息，支付完成后发送支付结果通知时会透传给商户
    "notifyurl": NOTIFYURL                   // 商户服务端接收支付结果通知的地址
  };

  // 获取签名
  var order_sign = utils.IAppSignFunc(order_data, privateKey, 'md5WithRSA');

  // 下单对象转json字符串

  order_data = JSON.stringify(order_data);

  var order_str = {
    transdata: order_data,
    sign: order_sign,
    signtype: 'RSA'
  };

  order_str = utils.serialize(order_str, false, 'encode');

  http({
    url: 'http://ipay.iapppay.com:9999/payapi/order',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: order_str
  }, function (err, response, body) {
    // 获得回调参数，先URI解码
    var order_return = decodeURIComponent(body, 'utf-8');

    // 将键值对参数转换为对象
    order_return = utils.getParameter(order_return);

    try {
      // 获取transdata，判断是否有错误信息
      var transdata = JSON.parse(order_return['transdata']);
      if (!transdata.transid) {
        cb(transdata.errmsg, null);
        return;
      }

      // 获取签名
      var order_return_sign = order_return['sign'];

      // 获取验签结果
      var checkSign = utils.IAppVerifyFunc(transdata, publicKey, 'md5WithRSA', order_return_sign);

      if (!checkSign) {
        cb('验证签名失败！', null);
        return;
      }

      // 签名正确，返回爱贝支付平台返回的订单号
      cb(null, transdata);
      return;

    } catch (e) {
      cb(e, null);
      return;
    }

  });
};

// 网页端接入支付API
var webPayAPI = function (params, cb) {
  var pay_data = {
    "tid": params.transid,
    "app": APPID,
    "url_r": params.url_r,
    "url_h": params.url_h
  }

  // 获取签名
  var pay_sign = utils.IAppSignFunc(pay_data, privateKey, 'md5WithRSA');

  // 支付对象转json字符串

  pay_data = JSON.stringify(pay_data);

  // 将请求对象组装好
  var pay_str = {
    data: pay_data,
    sign: pay_sign,
    sign_type: 'RSA'
  }

  pay_str = utils.serialize(pay_str, true, 'encode');

  http({
    url: 'https://web.iapppay.com/pay/gateway?' + pay_str,
    method: 'GET'
  }, function (err, response, body) {
    // 这里要特别注意获取的body并非我们想要的
    // 因为需要拿到这个接口重定向之后的地址
    cb(null, {url: response.request.href});
  });
};

module.exports = {
  getPayPage: function (req, res, next) {
    var query = req.query;

    if (!query.cporderId || !query.appuserId || !query.waresId || !query.waresName || !query.price || !query.returnUrl || !query.cpprivateInfo) {
      res.json({code: 500, msg: '参数错误'});
      return;
    }

    // 获取订单号
    getOrderAPI(query, function (err, order) {
      if (err) {
        return res.json({code: 500, msg: err});
        return next();
      }
      
      // 获取到的 order.transid 为网页端支付的tid
      webPayAPI({
        transid: order.transid,
        url_r: query.returnUrl,
        url_h: query.returnUrl
      }, function (err, payData) {
        if (err) {
          return res.json({code: 500, msg: err});
          return next();
        }
        // 获取到支付地址，返回给客户端
        return res.json({code: 200, data: payData});
        return next();
      });
    });

  },
  payResult : function (req, res, next) {
    // 获取爱贝支付回调
    var reqBody = req.body;

    try {
      // 获取transdata，判断是否有错误信息
      var transdata = JSON.parse(reqBody['transdata']);
      if (!transdata.cporderid) {
        return res.json({code: 500, msg: '支付错误'});
        return next();
      }

      // 获取签名
      var req_body_sign = reqBody['sign'];

      // 获取验签结果
      var checkSign = utils.IAppVerifyFunc(transdata, publicKey, 'md5WithRSA', req_body_sign);

      if (!checkSign) {
        return res.json({code: 500, msg:'验证签名失败！'});
        return next();
      }

      // TODO 此处处理自己的业务逻辑，
      // 处理完成后返回'SUCCESS'，如果不返回该信息，则支付平台会重复相同的订单通知
      return res.send('SUCCESS');
      return next();

    } catch (e) {
      console.error(e);
      return next();
    }

  }
}
