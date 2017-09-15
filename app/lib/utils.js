var crypto = require('crypto');

module.exports = {
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

  /* 封装签名函数 */
  /* signObj 需要签名的对象 */
  /* signType签名算法，默认md5 */
  /* needAPISecret是否需要添加API密钥，默认需要 */
  signFunc: function (signObj, APISecret, signType, needAPISecret) {
    if (!signObj) {
      return 'error sign';
    }
    var signType = signType || 'md5';
    signType = signType.toLocaleLowerCase();
    if (signType !== 'md5' && signType !== 'sha1' && signType !== 'sha256') {
      signType = 'md5';
    }
    var needAPISecret = needAPISecret || true;
    /* ASCII码排序签名对象 */
    signObj = this.ASCIIDesc(signObj);

    /* 定义待加密字符串str */
    var signStr = '';
    for(var i in signObj) {
      signStr += i + '=' + signObj[i] + '&';
    }

    if (needAPISecret) {
      /* 拼接API密钥 */
      signStr += 'key=' + APISecret;
    }
    
    /* 签名 */
    return crypto.createHash(signType).update(signStr).digest('hex').toLocaleUpperCase();
  },
  /* 手动拼接发请求需要的xml文档 */
  /* 参数 */
  /* obj: 需要拼接的对象 */
  /* addCDATA: 是否将参数加上CDATA(默认不需要) */
  getUnifiedXmlParams: function (obj, addCDATA){
    var addCDATA = addCDATA || false;
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
  /* 取得微信端返回来的xml标签里的value */
  /* 参数： */
  /* node_name: 需要取值的参数名 */
  /* xml：需要取值的xml文档 */
  /* flag: xml文档返回值中是否有中括号(默认没有) */
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
  }
};