const Tips = require('./tips');
const IS = require('is');
const php_date = require('locutus/php/datetime/date');
const strtotime = require('locutus/php/datetime/strtotime');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('../db/index');
let util = {
    formatData(params, valids) {
        let res = true;
        if (!IS.object(params) || !IS.array(valids)) return false;
        for (let i = 0; i < valids.length; i++) {
            let e = valids[i];
            let {key, type} = e;
            if (!key) {
                res = false;
                break;
            }
            let value = params[key] || '';
            if (type === 'not_empty') {
                if (IS.empty(value)) {
                    res = false;
                    break;
                }
            } else if (type === 'number') {
                value = Number(value);
                if (!IS.number(value) || IS.nan(value)) {
                    res = false;
                    break;
                }
            } else if(type === 'reg'){
                let reg = e['reg'];
                if(!reg || !reg.test(value)){
                    res = false;
                    break;
                }
            }else {
                if (!IS[type](value)) {
                    res = false;
                    break;
                }
            }
        }
        return res;
    },
    filter(params, filterArr) {
        if (IS.object(params) && IS.array(filterArr)) {
            let data = {};
            filterArr.forEach(e => {
                let val = params[e];
                if (!IS.undefined(val) && !IS.null(val) && !IS.empty(val) || IS.array.empty(val)) {
                    data[e] = val;
                }
            });
            return data;
        } else {
            return params;
        }
    },
    formatCurrentTime(create_time) {
        let time = create_time ? strtotime(create_time) * 1000: Date.now();
        return php_date('Y-m-d H:i:s', time/1000);
    },
    checkLogin(ctx) {
        let uid = ctx.cookies.get('uid');
        return !uid ? Tips[1005] : Tips[0];
    },
    generateToken(data) {
        let created = Math.floor(Date.now() / 1000);
        let cert = fs.readFileSync(path.join(__dirname, '../config/pri.pem'));
        let token = jwt.sign({
            data,
            exp: created + 3600 * 24
        }, cert, {algorithm: 'RS256'});
        return token;
    },
    verifyToken(token){
        let cert = fs.readFileSync(path.join(__dirname, '../config/pub.pem')),res = {};
        try {
            let result = jwt.verify(token, cert, {algorithms: ['RS256']}) || {};
            let {exp = 0} = result, current = Math.floor(Date.now()/1000);
            if (current <= exp) {
                res = result.data || {};
            }
        }catch (e) {

        }
        return res;
    },

    cleanData(data) {
        data.forEach(item => {
            Object.keys(item).forEach(key => {
                if (key === 'part1_xm' || key === 'part1_lxr') {
                    let name_arr = (item[key]).split('');
                    name_arr[name_arr.length - 1] = '*';
                    item[key] = name_arr.join('');
                }
                if (key === 'part1_hzlxdh' || key === 'part1_lxrdh' || key === 'part1_xzzdh' || key === 'part1_dwdh') {
                    if (item[key]) {
                        let phone_arr = (item[key]).split('');
                        if (phone_arr.length === 11) {
                            phone_arr[3] = phone_arr[4] = phone_arr[5] = phone_arr[6] = '*';
                        }
                        item[key] = phone_arr.join('');
                    }
                }
            })
        })
    },

    generateCategory(data, key) {
        const type = [];
        data.forEach(item => {
            const result = type.findIndex((value, index, arr) => {
                return value.type === item[key];
            });
            if (result < 0) {
                type.push({
                    type: item[key],
                    data: [item]
                });
            } else {
                type[result].data.push(item);
            }
        });
        return type;
    },

    completeRow(data, max_length, set_value) {
        data.forEach(item => {
            if (item.length < max_length) {
                let length = max_length - item.length;
                for (let i = 0; i < length; i ++) {
                    item.push(set_value);
                }
            }
        });
        return data;
    },

    uniqArray(array, key) {
        const element_map = {};
        const new_arr = [];
        array.forEach(item => {
            element_map[item[key]] = item;
        });
        Object.keys(element_map).forEach(key => {
            new_arr.push(element_map[key]);
        });
        return new_arr;
    }
};

module.exports = util;