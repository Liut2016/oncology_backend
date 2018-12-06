const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const fs = require('fs');

router.get('/oa/patients' ,async (ctx, next) => {
    let sql = 'SELECT * FROM PART1;';
    await db.query(sql).then(res => {
        res.forEach(item => {
            Object.keys(item).forEach(key => {
                if (key === 'PART1_xm' || key === 'PART1_lxr') {
                    let name_arr = (item[key]).split('');
                    name_arr[name_arr.length - 1] = '*';
                    item[key] = name_arr.join('');
                }
                if (key === 'PART1_lxdh' || key === 'PART1_lxrdh') {
                    let phone_arr = (item[key]).split('');
                    if (phone_arr.length === 11) {
                        phone_arr[3] = phone_arr[4] = phone_arr[5] = phone_arr[6] = '*';
                    }
                    item[key] = phone_arr.join('');
                }
            })
        });
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

module.exports = router;