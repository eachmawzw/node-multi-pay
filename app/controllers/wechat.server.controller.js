var crypto = require('crypto');
var uuid = require('uuid');
var request = require('request');

// 需要用到的工具类
var utils = require('../lib/utils');

const APPID = '';                   // 商户AAPID
const MCH_ID = '';                  // 商户设备ID
const DEVICE_INFO = 'WEB';          // 微信公众号支付填WEB
const DD_BODY = '';                 // 购买信息
// 微信支付回调接口地址（其中的域名为该node服务器配置的域名）
const NOTIFY_URL = 'https://xxx.xxx.com/api/payResult';
const TRADE_TYPE = 'JSAPI';

const AppSecret = '';               // 商户AppSecret
const APISecret = '';               // 签名密钥
/* 微信JSSDK配置目录（前端页面的指定路由下面的JSSDK授权目录） */
const wxConfigSignUrl = 'https://xxx.xxx.com';
const wechatPayOrderList = [];

/* 基本AccessToken对象 */
/* 这个对象直接存储在内存中，通过接口得到的token会存储于这个对象 */
/* 接口每次取值会验证token是否过期，如果过期，则异步刷新该token */
var BASE_ACCESS_TOKEN_OBJ = {
  access_token: '',
  expire_time: 0
};
/* jsapi_ticket对象 */
/* 这个对象直接存储在内存中，通过接口得到的ticket会存储于这个对象 */
/* 接口每次取值会验证ticket是否过期，如果过期，则异步刷新该ticket */
var JSAPI_TICKET_OBJ = {
  ticket: '',
  expire_time: 0
};


/* 获取网页授权AccessToken */
/* 文档地址：https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421140842 */
var getOAuthAccessTokenAPI = function (query, cb) {
  request({
    url: 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + APPID + '&secret=' + AppSecret + '&code=' + query.code + '&grant_type=authorization_code',
    method: 'GET'
  }, function (err, response, body) {
    if (err) {
      cb(err, null);
      return;
    }
    if (!err && response.statusCode !== 200) {
      console.log('请求失败');
      cb(null, {code: 500, msg: '请求失败'});
      return;
    }
    cb(null, JSON.parse(body));
  });
};

/* 刷新网页授权AccessToken */
/* 文档地址：https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421140842 */
var refreshOAuthAccessTokenAPI = function (query, cb) {
  request({
    url: 'https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=' + APPID + '&grant_type=refresh_token&refresh_token=' + query.refresh_token,
    method: 'GET'
  }, function (err, response, body) {
    if (err) {
      cb(err, null);
      return;
    }
    if (!err && response.statusCode !== 200) {
      console.log('请求失败');
      cb(null, {code: 500, msg: '请求失败'});
      return;
    }
    cb(null, JSON.parse(body));
  });
};


/* 微信统一下单API */
/* 文档地址：https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_1 */
var createWechatOrderAPI = function (data, cb) {
  /* 定义下单参数对象 */
  var payObj = {
    appid: APPID,                              // 公众账号ID（微信公众平台查找）
    mch_id: MCH_ID,                            // 商户号（微信商户平台查找）
    device_info: DEVICE_INFO,                  // 设备号（公众号支付填WEB）
                                               // 32位随机字符串
    nonce_str: crypto.randomBytes(16).toString('hex').toLocaleUpperCase(),
    body: DD_BODY,                             // 商品描述，会写在用户支付界面，作为标题
    attach: data.attach,                       // 附加数据，在查询API和支付通知中原样返回，可作为自定义参数使用。
    /* 微信要求商户订单号不超过32位，正则表达式去掉所有-号 */
    // out_trade_no: uuid.v1().replace(/-/g, ''), // 商户订单号
    out_trade_no: data.outTradeNo,             // 商户订单号
    total_fee: data.totalFee,                  // 支付金额（单位为分）
    spbill_create_ip: data.spbillIP,           // 发起支付的用户IP
    notify_url: NOTIFY_URL,                    // 这是微信通知后台支付结果的链接，具体见接口payResult
    trade_type: TRADE_TYPE,                    // 交易类型，公众号支付填JSAPI
    openid: data.openid                        // 用户唯一openid
  };

  /* 调用签名函数 */
  var sign = utils.signFunc(payObj, APISecret);

  /* 下单参数对象添加签名字段 */
  payObj.sign = sign;

  /* 下单参数对象转xml文档 */
  var xml = utils.getUnifiedXmlParams(payObj);

  console.log(xml)

  /* 发送下单请求 */
  request({
    url: 'https://api.mch.weixin.qq.com/pay/unifiedorder',
    method: 'POST',
    body: xml
  }, function (err, response, body) {
    // console.log(body.toString('uft-8'))
    if (err) {
      cb(err, null);
      return;
    }

    if (!err && response.statusCode !== 200) {
      console.log('请求失败');
      cb(null, {code: 500, msg: '请求失败'});
      return;
    }

    if (!err && response.statusCode === 200) {

      // 返回来的XML数据
      var _reBodyXml = body.toString('uft-8');
      // console.log('return xml data ==', _reBodyXml);

      // 取得return_code进行成功与否判断
      var _reCode = utils.getXMLNodeValue('return_code', _reBodyXml, false);
      
      // 返回的状态如果为FAIL，说明与微信服务器通信失败
      if (_reCode === 'FAIL') {
        console.log('通信失败');
        var _reMsg = utils.getXMLNodeValue('return_msg', _reBodyXml, false);
        cb(null, {code: 500, msg: _reMsg});
        return;
      }

      /* 定义前端需要支付下单的请求参数对象 */
      var rePrepayParams = {
          appId: APPID,                        // 公众账号ID（微信公众平台查找）
          /* 标准北京时间，时区为东八区，自1970年1月1日 0点0分0秒以来的秒数。注意：部分系统取到的值为毫秒级，需要转换成秒(10位数字) */
          /* 注意这个参数最后要转成字符串 */
          timeStamp: parseInt(Date.now()/1000).toString(),
          nonceStr: crypto.randomBytes(16).toString('hex').toLocaleUpperCase(),
          package: '',                         // 订单详情扩展字段，需要填入统一下单接口返回的prepay_id
          signType: 'MD5'                      // 签名方式：MD5
      };

      /* 判断订单是否发送成功（通信标识） */
      if (_reCode === 'SUCCESS') {
        console.log('通信成功')

        var _resultCode = utils.getXMLNodeValue('result_code', _reBodyXml, false);
        /* 判断订单是否提交成功（业务标识） */

        // 返回的resultCode如果为FAIL，说明业务失败，订单未成功
        if (_resultCode === 'FAIL') {
          console.log('订单未成功');
          var _errCodeDes = utils.getXMLNodeValue('err_code_des', _reBodyXml, false);
          cb(null, {code: 500, msg: _errCodeDes});
          return;
        }

        if (_resultCode === 'SUCCESS') {
          console.log('提交成功');

          /* 成功时返回prepay_id */
          var _prepayId = utils.getXMLNodeValue('prepay_id', _reBodyXml, false);

          /* 赋值参数package */
          rePrepayParams.package = 'prepay_id=' + _prepayId;

          /* 这里可以进行其他支付方式的判断，这里只进行公众号支付判断 */
          /* 其他支付方式逻辑可以在之后扩展 */
          if(payObj.trade_type == 'JSAPI') {

            /* 调用签名函数 */
            var _signPara = utils.signFunc(rePrepayParams, APISecret);

            /* 前端需要支付下单的请求参数对象添加签名字段 */
            rePrepayParams.paySign = _signPara;

            // console.log(rePrepayParams);
            cb(null, {code: 200, data: rePrepayParams});
            return;
          }
        }
      }
    }
  });
};

/* 基本AccessToken(公众号的全局唯一接口调用凭据) */
/* JSAPI配置中签名所需要的jsapi_ticket需要这个凭据调用 */
/* 调用该接口还必须将调用该接口的服务器IP地址添加为白名单，在公众号设置里面添加 */
/* 文档地址：https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421140183 */
var getBaseAccessTokenAPI = function (data, cb) {
  /* 开发阶段手动填写的测试数据，避免请求次数过多微信服务器拒绝请求 */
  /* 这个接口调用次数上限为2000次/天 */
  /* 正式环境时注释测试代码，将逻辑代码放出来 */
  // BASE_ACCESS_TOKEN_OBJ.access_token = 'oYuOpFoJZ4Qo_91A8mN2Ds9LgNbwG22PmDiZjn__OtYkGadceGg3pjHv6YrUIl1-eZeLutzkHWEzPFj3eGHMBBmZg_uT-PAyVrIRbYMjQkeeBt1lUiiRV3ZFdfepEWngEKUhADAIOY';
  // BASE_ACCESS_TOKEN_OBJ.expire_time = Date.now();
  // cb(null, BASE_ACCESS_TOKEN_OBJ);
  // return;

  /* --------------------------分割线---------------------------- */
  /* 生产阶段代码 */
  /* 如果access_token存在并且超时时间大于当前时间，则token有效，不需要重新发起请求 */
  if (!!BASE_ACCESS_TOKEN_OBJ.access_token && BASE_ACCESS_TOKEN_OBJ.expire_time > Date.now()) {
    cb(null, BASE_ACCESS_TOKEN_OBJ);
    console.log('取access_token内存数据');
    return;
  }
  /* 否则，发起获取token请求 */
  request({
    url: 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + APPID + '&secret=' + AppSecret,
    method: 'GET'
  }, function (err, response, body) {
    console.log('发起了一次获取access_token请求');
    if (err) {
      cb(err, null);
      return;
    }

    if (!err && response.statusCode !== 200) {
      console.log('请求失败');
      cb(null, {code: 500, msg: '请求失败'});
      return;
    }
   
    var tokenObj = JSON.parse(body);
    console.log('access_token', tokenObj);
    if (tokenObj.hasOwnProperty('errcode') && tokenObj.errcode !== 0) {
      cb(null, tokenObj);
      return;
    }
    BASE_ACCESS_TOKEN_OBJ.access_token = tokenObj.access_token;
    /* 设置本地超时时间为微信接口给的超时时间的一半 */
    BASE_ACCESS_TOKEN_OBJ.expire_time = Date.now() + tokenObj.expires_in * 500;
    cb(null, BASE_ACCESS_TOKEN_OBJ);
  });
};


/* 获取jsapi_ticket(用于签名算法的其中的一个参数) */
/* 还用于其他接口的参数 */
var getJsapiTicketAPI = function (token, cb) {
  /* 开发阶段手动填写的测试数据，避免请求次数过多微信服务器拒绝请求 */
  /* 这个接口调用次数上限为2000次/天 */
  /* 正式环境时注释测试代码，将逻辑代码放出来 */
  // JSAPI_TICKET_OBJ.ticket = 'kgt8ON7yVITDhtdwci0qeSyeuM3_RQ2iFGRP99StV1ZLb7Y_Sz9yGiS5kQspPHpcuov42-KxDj4c84IUi1vosw';
  // JSAPI_TICKET_OBJ.expire_time = Date.now();
  // cb(null, JSAPI_TICKET_OBJ);
  // return;

  /* --------------------------分割线---------------------------- */
  /* 生产阶段代码 */
  /* 验证access_token */
  if (!token) {
    cb('access_token不能为空', null);
    return;
  }
  /* 如果ticket存在并且超时时间大于当前时间，则ticket有效，不需要重新发起请求 */
  if (!!JSAPI_TICKET_OBJ.ticket && JSAPI_TICKET_OBJ.expire_time > Date.now()) {
    cb(null, JSAPI_TICKET_OBJ);
    console.log('取ticket内存数据');
    return;
  }

  /* 否则，发起获取ticket请求 */
  request({
    url: 'https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=' + token + '&type=jsapi',
    method: 'GET'
  }, function (err, response, body) {
    console.log('发起了一次获取ticket请求');
    if (err) {
      cb(err, null);
      return;
    }

    if (!err && response.statusCode !== 200) {
      console.log('请求失败');
      cb(null, {code: 500, msg: '请求失败'});
      return;
    }

    var ticketObj = JSON.parse(body);
    console.log('ticket', ticketObj)
    if (ticketObj.hasOwnProperty('errcode') && ticketObj.errcode !== 0) {
      cb(null, ticketObj);
      return;
    }
    JSAPI_TICKET_OBJ.ticket = ticketObj.ticket;
    /* 设置本地超时时间为微信接口给的超时时间的一半 */
    JSAPI_TICKET_OBJ.expire_time = Date.now() + ticketObj.expires_in * 500;
    cb(null, JSAPI_TICKET_OBJ);
  });
};

module.exports = {
  getOAuthAccessToken: function (req, res, next) {
    var query = req.query;
    if (!query.hasOwnProperty('code') || !query.hasOwnProperty('state')) {
      return res.json({code: 500, msg: '参数错误！'});
      return next();
    }
    getOAuthAccessTokenAPI(query, function (err, data) {
      if (err) {
        return next(new Error(err));
      }
      /* 将查询到的access_token和错误信息直接返回给前台 */
      if (data.hasOwnProperty('errcode')) {
        return res.json({code: data.errcode, msg: data.errmsg});
        return next();
      }
      return res.json({code: 200, data: data});
      return next();
    });
  },
  refreshOAuthAccessToken: function (req, res, next) {
    var query = res.query;
    if (!query.hasOwnProperty('refresh_token')) {
      return res.json({code: 500, msg: '参数错误！'});
      return next();
    }
    refreshOAuthAccessTokenAPI(query, function (err, data) {
      /* 将查询到的access_token和错误信息直接返回给前台 */
      if (data.hasOwnProperty('errcode')) {
        return res.json({code: data.errcode, msg: data.errmsg});
        return next();
      }
      return res.json({code: 200, data: data});
      return next();
    });
  },
  // 微信JSSDK验证所需的配置参数
  // 参数返回后，需要在前端配置
  // 配置好后，就可以在微信内置浏览器中使用JSSDK提供的原生接口
  wechatConfig: function (req, res, next) {
    /* 首先获取access_token */
    getBaseAccessTokenAPI(null, function (err, data) {
      if (err) {
        return next(new Error(err));
      }
      if (data.hasOwnProperty('errcode') && data.errcode !== 0) {
        return res.json({code: data.errcode, msg: data.errmsg});
        return next();
      }
      /* 然后根据access_token获取jsapi_ticket */
      getJsapiTicketAPI(data.access_token, function (err, data1) {
        if (err) {
          return next(new Error(err));
        }
        if (data1.hasOwnProperty('errcode') && data1.errcode !== 0) {
          return res.json({code: data1.errcode, msg: data1.errmsg});
          return next();
        }
        /* 定义微信config对象 */
        var _wxConfig = {
          debug: true, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
          appId: APPID, // 必填，公众号的唯一标识
          timestamp: Date.now(), // 必填，生成签名的时间戳
          nonceStr: crypto.randomBytes(16).toString('hex').toLocaleUpperCase(), // 必填，生成签名的随机串
          jsApiList: ['chooseWXPay'] // 必填，需要使用的JS接口列表，所有JS接口列表见附录2
        }

        /* 定义参与签名的对象 */
        var _signObj = {
          noncestr: _wxConfig.nonceStr,
          jsapi_ticket: data1.ticket,
          timestamp: _wxConfig.timestamp,
          url: wxConfigSignUrl
        }

        /* 使用sha1加密算法签名 */
        var sign = utils.signFunc(_signObj, null, 'sha1', false);

        /* 签名加入config对象 */
        _signObj.signature = sign;

        return res.json({code: 200, data: _signObj});
        return next();
      });
    });
  },
  wechatPay: function (req, res, next) {
    var query = req.query;
    console.log(query);
    /* 支付有一些参数是根据前端来传送的，根据自己的业务需求来指定需要传递哪些参数 */
    if (!query.hasOwnProperty('attach') || !query.hasOwnProperty('openid') || !query.hasOwnProperty('totalFee') || !query.hasOwnProperty('outTradeNo')) {
      return res.json({code: 500, msg: '参数错误！'});
      return next();
    }
    /* 调用统一下单API */
    createWechatOrderAPI({
      attach: query.attach,
      openid: query.openid, 
      totalFee: query.totalFee,
      outTradeNo: query.outTradeNo,
      /* express 框架提供可以拿到目标ip,正则表达式去掉冒号和f */
      spbillIP: req.connection.remoteAddress.replace(/:|f/g, '')
    }, function (err, orderData) {
      if(err) {
        return next(new Error(err));
      }
      return res.json(orderData);
      return next();
    });
  },
  
  /* 微信支付成功后要调用的接口 */
  /* 该接口一定要能够正确地把接受到消息的返回给微信主动发起的请求 */
  /* 否则微信会来个“八连杀”，只有在接收到正确的回复后不再发送 */
  payResult: function (req, res, next) {

    var xmlBody = req.body;
    console.log(xmlBody);
    /* 需要返回的对象 */
    var _rePayResult = {};
    /* 需要返回的对象转xml */
    var _rePayResultXml = '';

    /* 验证body参数是否为xml文档 */
    if (!xmlBody.hasOwnProperty('xml')) {
      _rePayResult = {
        return_code: 'FAIL',
        return_msg: '数据格式不是xml文档'
      }
      _rePayResultXml = utils.getUnifiedXmlParams(_rePayResult, true);
      return res.send(_rePayResultXml);
      return next();
    }

    if (xmlBody.hasOwnProperty('xml')) {
      /* 遍历wechatPayOrderList是否存在当前订单 */
      var existOrder = wechatPayOrderList.some(function (order_item) {
        return xmlBody.xml.nonce_str[0] === order_item;
      });

      /* 如果内存中已经存在该订单，直接返回成功 */
      if (existOrder) {
        console.log('订单已存在！');
        _rePayResult = {
          return_code: 'SUCCESS',
          return_msg: 'OK'
        }
        _rePayResultXml = utils.getUnifiedXmlParams(_rePayResult, true);
        return res.send(_rePayResultXml);
        return next();
      }

      var _rePayContent = {};
      /* 格式化接收到的文档，并做签名认证 */
      for (var param in xmlBody.xml) {
        if (param !== 'sign') {
          _rePayContent[param] = xmlBody.xml[param][0];
        }
      }
      /* 本地计算得到签名sign */
      var sign = utils.signFunc(_rePayContent, APISecret);
      /* 如果签名匹配不上，说明请求参数被篡改，返回签名无效 */
      if (sign !== xmlBody.xml.sign[0]) {
        _rePayResult = {
          return_code: 'FAIL',
          return_msg: '签名无效'
        }
        _rePayResultXml = utils.getUnifiedXmlParams(_rePayResult, true);
        return res.send(_rePayResultXml);
        return next();
      }

      if (sign === xmlBody.xml.sign[0]) {
        console.log('处理订单逻辑！');
        wechatPayOrderList.push(_rePayContent.nonce_str);
        _rePayResult = {
          return_code: 'SUCCESS',
          return_msg: 'OK'
        }
        _rePayResultXml = utils.getUnifiedXmlParams(_rePayResult, true);

        /* 此处写上自己的业务逻辑，把需要存储的订单信息发送给业务后台 */
        /* _rePayContent: 需要存到数据后台的支付结果对象 */
      }
    }
  }
};