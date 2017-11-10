var crypto = require('crypto');

module.exports = {
  getDateTime: function (dateStr) {
    var date = new Date(dateStr)
    if (!dateStr || date === 'Invalid Date') {
      return ''
    }
    var momentDate, year, month, day, hour, minute, second
    year = date.getFullYear()
    month = date.getMonth() + 1
    day = date.getDate()
    hour = date.getHours()
    minute = date.getMinutes()
    second = date.getSeconds()
    month = month < 10 ? '0' + month : month
    day = day < 10 ? '0' + day : day
    hour = hour < 10 ? '0' + hour : hour
    minute = minute < 10 ? '0' + minute : minute
    second = second < 10 ? '0' + second : second
    momentDate = year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second
    return momentDate
  },
  // 序列化对象
  // obj 需要序列化的对象
  // isCode 是否编码对象的值和属性，默认false
  // codeType 支持encode编码，decode编码
  serialize: function (obj, isCode, codeType) {
    if (!obj) {
      console.log('serialize: 不是一个对象');
      return;
    }

    isCode = isCode || false;

    var str = '';
    for(var i in obj) {
      if (isCode && codeType === 'encode') {
        str += i + '=' + encodeURIComponent(obj[i], 'base64') + '&';
      } else if (isCode && codeType === 'decode') {
        str += i + '=' + decodeURIComponent(obj[i], 'base64') + '&';
      } else {
        str += i + '=' + obj[i] + '&';
      }
    }
    str = str.slice(0, str.length - 1);
    return str;
  },
  /* 数组对象根据ASCII码排序 */
  ASCIIDesc: function (obj) {
    var newObj = {};
    var newArr = [];
    /* 对象key存入数组 */
    for(var i in obj) {
      newArr.push(i);
    }
    /* 冒泡排序，得到排序后的数组 */
    for(var i=0; i<newArr.length; i++) {
      var temp = newArr[0];
      var len = newArr.length - i;
      for(var j=1; j<len; j++) {
        if (newArr[j] < temp) {
          temp = newArr[j - 1];
          newArr[j - 1] = newArr[j];
          newArr[j] = temp;
        } else {
          temp = newArr[j];
        }
      }
    }
    /* 将排序好的数组插入新对象 */
    newArr.forEach(function (item) {
      newObj[item] = obj[item];
    });
    return newObj;
  },
  /* hash加密签名函数（微信支付适用） */
  /* signObj 需要签名的对象 */
  /* signType签名算法，默认md5 */
  /* needAPISecret是否需要添加API密钥，默认需要 */
  /* APISecret 签名密钥 */
  hashSignFunc: function (signObj, APISecret, signType, needAPISecret) {
    needAPISecret = needAPISecret === false ? false : true;

    if (!signObj) {
      return 'error sign';
    }
    var signType = signType || 'md5';
    if (signType !== 'md5' && signType !== 'sha1' && signType !== 'sha256') {
      signType = 'md5';
    }
    /* ASCII码排序签名对象 */
    signObj = this.ASCIIDesc(signObj);

    /* 定义待加密字符串str */
    var signStr = this.serialize(signObj);

    if (needAPISecret) {
      /* 拼接API密钥 */
      signStr += '&key=' + APISecret;
    }
    
    /* 签名 */
    return crypto.createHash(signType).update(signStr).digest('hex').toLocaleUpperCase();
  },
  /* 私钥签名函数（支付宝支付适用） */
  /* signObj 需要签名的对象 */
  /* privateKey 私钥 */
  /* signType 签名类型，支持RSA1,RSA2 */
  createSignFunc: function (signObj, privateKey, signType) {

    if (!signObj) {
      return 'error sign';
    }
    var signType = signType || 'RSA1';

    /* ASCII码排序签名对象 */
    signObj = this.ASCIIDesc(signObj);

    /* 定义待加密字符串str */
    var signStr = this.serialize(signObj);

    /* 签名 */
    var sha;

    if (signType === 'RSA1') {
      sha = crypto.createSign('RSA-SHA1');
    } else if (signType === 'RSA2') {
      sha = crypto.createSign('RSA-SHA256');
    } else if (signType === 'md5WithRSA') {
      sha = crypto.createSign('md5WithRSAEncryption');
    }

    sha.update(signStr);

    sha = encodeURIComponent(sha.sign(privateKey, 'base64'));

    return sha;   
  },
  /* 验签函数 */
  /* verifyObj 需要验签的对象 */
  /* publicKey 数据发送方的公钥 */
  /* signType 签名类型，支持RSA1,RSA2 */
  /* sign 数据发送方提供的签名 */
  verifySignFunc: function (verifyObj, publicKey, signType, sign) {
    if (!verifyObj) {
      return 'error sign';
    }
    var signType = signType || 'RSA1';

    /* ASCII码排序签名对象 */
    verifyObj = this.ASCIIDesc(verifyObj);

    /* 定义待加密字符串str */
    var verifyStr = this.serialize(verifyObj);

    var verify;

    if (signType === 'RSA1') {
      verify = crypto.createVerify('RSA-SHA1');
    } else if (signType === 'RSA2') {
      verify = crypto.createVerify('RSA-SHA256');
    }

    verify.update(verifyStr);

    return verify.verify(publicKey, sign, 'base64');
  },
  // 爱贝支付的签名过程有些不同，因此单独拿出来做一个方法
  /* 私钥签名函数（爱贝支付适用） */
  /* signObj 需要签名的对象 */
  /* privateKey 私钥 */
  /* 签名类型，支持md5WithRSA */
  IAppSignFunc: function (signObj, privateKey, signType) {
    // 下单对象转json字符串
    signObj = JSON.stringify(signObj);

    //  签名
    var sign;

    if (signType === 'md5WithRSA') {
      // md5withRSA签名
      sign = crypto.createSign('md5WithRSAEncryption');

    } else {
      return;
    }

    // 将signObj组装好的json字符串转为字节数组，进行签名
    sign.update(new Buffer(signObj));

    sign = sign.sign(privateKey, 'base64');

    return sign;
  },
  // 爱贝支付的签名过程有些不同，因此单独拿出来做一个方法
  /* 验签函数 */
  /* verifyObj 需要验签的对象 */
  /* publicKey 数据发送方的公钥 */
  /* signType 签名类型，支持md5WithRSA */
  /* sign 数据发送方提供的签名 */
  IAppVerifyFunc: function (verifyObj, publicKey, signType, sign) {
    if (!verifyObj) {
      return 'error sign';
    }
    var signType = signType || 'md5WithRSA';

    // 转为JSON对象字符串
    var verifyStr = JSON.stringify(verifyObj);

    // 验签
    var verify;

    if (signType === 'md5WithRSA') {
      verify = crypto.createVerify('md5WithRSAEncryption');
    } else {
      return;
    }

    verify.update(new Buffer(verifyStr));

    return verify.verify(publicKey, sign, 'base64');
  },
  /* 手动拼接发请求需要的xml文档 */
  /* 参数 */
  /* obj: 需要拼接的对象 */
  /* addCDATA: 是否将参数加上CDATA */
  getUnifiedXmlParams: function (obj, addCDATA){
    addCDATA = addCDATA || false;
    var body = '<xml>';
    for (var param in obj) {
      if (addCDATA === true) {
        body += '<' + param + '><![CDATA[' + obj[param] + ']]></' + param + '>';
      } else {
        body += '<' + param + '>' + obj[param] + '</' + param + '>';
      }
    }
    body += '</xml>';
    return body;
  },
  //取得xml标签里的value
  getXMLNodeValue: function (node_name, xml, flag){
    flag = flag || false;
    var _reNodeValue = '';
    var tmp = xml.split('<' + node_name + '>');
    if (tmp) {
      var _tmp = tmp[1].split('</' + node_name + '>')[0];
      if (!flag) {
        var _tmp1 = _tmp.split('[');
        _reNodeValue = _tmp1[2].split(']')[0];
      } else {
        _reNodeValue = _tmp;
      }    
    }
    return _reNodeValue;
  },
  getParameter: function (param) {
    if (!param || typeof param !== 'string') {
      console.error('param type error');
      return {};
    }
    var splitArr = param.split('&').map(item => {
      var arr = item.split('=');
      return arr;
    });

    var parameter = {}

    splitArr.forEach(item => {
      parameter[item[0]] = item[1]
    })

    return parameter;
  }
}