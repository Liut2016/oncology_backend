const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');

router.get('/oa/patients' ,async (ctx, next) => {
    let sql = 'SELECT * FROM PART1;';
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

router.get('/oa/patient/:hos_id', async(ctx, next) => {
   let params = ctx.params;
   let {hos_id} = params;
   let sql = `SELECT * FROM PART1 WHERE PART1_zyh=${hos_id}`;
   await db.query(sql).then(res => {
       Utils.cleanData(res);
       ctx.body = {...Tips[0], data: res[0]}
   }).catch(e => {
       ctx.body = {...Tips[1002], reason:e}
   })
});

router.get('/oa/patient_1/:zyh', async(ctx, next) => {
    let params = ctx.params;
    let {zyh} = params;
    let sql = `SELECT * FROM FIRST_HOME WHERE part1_zylsh='${zyh}'`;
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res[0]}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason:e}
    })
});

router.get('/oa/patients_2' ,async (ctx, next) => {
    let sql = 'SELECT part1_pid, part1_bah, part1_xm, part1_nl, part1_xb, part1_cysj FROM SECOND_HOME;';
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

router.get('/oa/patient_2/:hos_pid', async(ctx, next) => {
    let params = ctx.params;
    let {hos_pid} = params;
    let fee_sql = `SELECT * FROM  SECOND_FEE WHERE PART1_bah = ${hos_pid};`;
    let home_sql = `SELECT * FROM  SECOND_HOME WHERE PART1_bah = ${hos_pid};`;
    const home_db = await db.query(home_sql);
    const fee_db = await db.query(fee_sql);
    Promise.all([home_db, fee_db]).then(res => {
        Utils.cleanData(res[0]);
        delete res[1][0]['part1_bah'];
        ctx.body = {
            state: 200,
            data: {
                part1: res[0][0],
                part2: res[1][0]
            }
        }
    }).catch(e => {
        ctx.body = {state: 500, error: e}
    });
});


//post方法实现一附院所有病人病案首页信息分页
router.post('/oa/patients1/',async (ctx, next) =>{
    var pagesize = parseInt(ctx.request.body.pagesize);
    var pageindex = parseInt(ctx.request.body.pageindex);
    var start = (pageindex-1) * pagesize;
    let sql1 = `SELECT * FROM FIRST_HOME limit ${start},${pagesize};`;
    let sql2 = 'SELECT COUNT(*) FROM FIRST_HOME;';
    //console.log(sql1);
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        num = res[1][0]['COUNT(*)'];
        data = res[0];
        //Utils.cleanData(res);
        ctx.body = {...Tips[0],count_num:num,data:data};

    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })

});

//通过pid获取一附院病人病案首页信息
router.get('/oa/patient1/:pid',async(ctx,next) => {
    let params = ctx.params;
    let {pid} = params;
    //console.log(ctx.params);
    //let sql = `SELECT * FROM FIRST_HOME WHERE part1_pid=${pid}`;
    await db.query(
        'select * from FIRST_HOME where part1_pid= ?',
        [pid]
    ).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0],data:res[0]}
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e}
    })
});

module.exports = router;