/* eslint-disable indent */
/* global define */
(function(global) {
  'use strict';

  const dateFormat = (...args) => {
    const token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|E{1,4}|[LloSZ]|"[^"]*"|'[^']*'/g;
    const pad = (val, len) => {
      val = String(val);
      len = len || 2;
      while(val.length < len) val = '0' + val;

      return val;
    };

    let date = args[0];
    let mask = args[1];

    // 파라미터가 1개이지만 첫번째 인자가 format
    if(args.length === 1 && args[0] !== null && !/\d/.test(args[0])) {
      date = undefined;
      mask = args[0];
    }

    date = date || new Date;
    if(!(date instanceof Date)) date = new Date(date);
    if(isNaN(date)) throw TypeError('Invalid date');

    mask = mask || 'yyyy-MM-dd HH:mm:ss';

    const flags = {
      yyyy: String(date.getFullYear()),
        yy: pad(date.getFullYear() % 1000),
        MM: pad(date.getMonth() + 1),
         M: date.getMonth() + 1,
        dd: pad(date.getDate()),
         d: date.getDate(),
        HH: pad(date.getHours()),
        mm: pad(date.getMinutes()),
        ss: pad(date.getSeconds()),
       EEE: ['일', '월', '화', '수', '목', '금', '토', '일'][date.getDay()],
      EEEE: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][date.getDay()]
    };

    return mask.replace(token, (match) => {
      if(match in flags)
        return flags[match];

      return match.slice(1, match.length - 1);
    });
  };

  if(typeof define === 'function' && define.amd) {
    define(() => {
      return dateFormat;
    });
  } else if(typeof exports === 'object') {
    module.exports = dateFormat;
  } else {
    global.dateFormat = dateFormat;
  }
})();

/*
case 'yyyy': return d.getFullYear();
case   'yy': return (d.getFullYear() % 1000).zf(2);
case   'MM': return (d.getMonth() + 1).zf(2);
case   'dd': return d.getDate().zf(2);
case  'E': return weekName[d.getDay()];
case   'HH': return d.getHours().zf(2);
case   'hh': return ((h = d.getHours() % 12) ? h : 12).zf(2);
case   'mm': return d.getMinutes().zf(2);
case   'ss': return d.getSeconds().zf(2);
case  'a/p': return d.getHours() < 12 ? '오전' : '오후';
default  : return $1;
*/
