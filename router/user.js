const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const md5 = require('md5');

router.post('/oa/login', async(ctx, next) => {
    let data = Utils.filter(ctx.request.body, ['name', 'password']);
    let res = Utils.formatData(data,[
        {key: 'name', type: 'string'},
        {key: 'password', type: 'string'}
    ]);
    if(!res) return ctx.body = Tips[1007];
    let { name, password } = data;
    let sql = 'SELECT uid FROM t_user WHERE name=? and password=? and is_delete=0', value = [name, md5(password)];
    await db.query(sql, value).then(res => {
        if (res && res.length > 0) {
            let val = res[0];
            console.log(val);
            let uid = val['uid'];
           let token = Utils.generateToken({uid});
            ctx.body = {...Tips[0], data:{token}};
        } else {
            ctx.body = Tips[1006];
        }
    }).catch(e => {
        console.log(e);
        ctx.body = Tips[1002];
    })
});

router.post('/oa/register', async(ctx, next) => {
    let data = Utils.filter(ctx.request.body, ['name', 'password']);
    let res = Utils.formatData(data, [
        {key: 'name', type: 'string'},
        {key: 'password', type: 'string'}
    ]);
    if (!res) return ctx.body = Tips[1007];
    let { name, password } = data;
    const create_time = Utils.formatCurrentTime('');
    let sql = 'INSERT INTO t_user (name, password, create_time) values (?, ?, ?)', value = [name, md5(password), create_time];
    await db.query(sql, value).then(res => {
        if (res && res.length > 0) {
            let val = res[0];
            console.log(val);
            let uid = val['uid'];
            let token = Utils.generateToken({uid});
            ctx.body = {...Tips[0], data:{token}};
        } else {
            ctx.body = Tips[1006];
        }
    }).catch(e => {
        console.log(e);
        ctx.body = Tips[1002];
    })
});

router.get('/oa/user/auth', async (ctx, next) => {
    let {uid} = ctx.state || {};
    let sql = 'SELECT name,uid,nick_name FROM t_user WHERE uid=? AND is_delete=0', value = [uid];
    await db.query(sql, value).then(res => {
        if (res && res.length > 0) {
            ctx.body = {...Tips[0], data: res[0]};
        } else {
            ctx.body = Tips[1005];
        }
    }).catch(e => {
        ctx.body = Tips[1005];
    })
});

router.post('/oa/quit', async(ctx, next) => {
    ctx.state = null;
    ctx.body = Tips[0];
});
module.exports = router;