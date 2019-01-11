const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const _ = require('lodash');

const basic_conditions = {
    patientID: 'part1_zylsh',
    patientName: 'part1_xm',
    Disease: 'part1_zzd'
};

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
    let sql_home = `SELECT * FROM FIRST_HOME WHERE part1_zylsh='${zyh}'`;
    let sql_advice = `SELECT * FROM FIRST_ADVICE WHERE part2_zyh = '${zyh}'`;
    const home = await db.query(sql_home);
    const advice = await db.query(sql_advice);
    Promise.all([home, advice]).then(res => {
       // Utils.cleanData(res);
        ctx.body = {...Tips[0], data: {home: res[0], advice: Utils.generateCategory(res[1], 'part2_yzlb')}}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason:e}
    })
});

router.get('/oa/patients_2' ,async (ctx, next) => {
    let sql = 'SELECT part1_pid, part1_bah, part1_xm, part1_nl, part1_xb, part1_cysj FROM SECOND_HOME;';
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res.slice(0, 10)}
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
    var conditions = ctx.request.body.condition;
    const condition_array = [];
    /*Object.keys(conditions).forEach(key => {
        if (conditions[key] !== '') {
            condition_array.push(`${basic_conditions[key]} = '${conditions[key]}'`);
        }
    });*/
    const condition_sql = 'WHERE ' + condition_array.join(' AND ');
    const start = (pageindex-1) * pagesize;
    let sql1 = `SELECT * FROM FIRST_HOME  ${condition_array.length === 0 ? '' :condition_sql} limit ${start},${pagesize};`;
    let sql2 = `SELECT COUNT(*) FROM FIRST_HOME ${condition_array.length === 0 ? '' :condition_sql};`;
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
router.get('/oa/patient1/:pid/:zyh',async(ctx,next) => {

    let {pid, zyh} = ctx.params;
    await queryPatient(pid, zyh).then((res) => {
        ctx.body = {
            ...Tips[0],
            data: {
                home: res[0],
                advice: Utils.generateCategory(res[1], 'part2_yzlb'),
                lis: Utils.generateCategory(res[2], 'part3_xmmc'),
                mazui: res[3],
                results: Utils.generateCategory(res[4], 'part5_jclb')
            }
        }
    }).catch(e => {
        ctx.body = {
            ...Tips[1002],
            error: e
        }
    })
});

router.get('/oa/es_list/', async (ctx, next) => {
    let {query} = ctx.query;
    const related_zyh = [];
    await db.es().search({
        body: {
            highlight: {
                require_field_match: false,
                fields: {
                    "*": {}
                }
            },
            query: {
                query_string: {
                    query: query
                }
            }
        },
        _source: [
            'part5_zyh'
        ]
    }).then(async (res)=> {

        res['hits']['hits'].forEach(item => {
            related_zyh.push(item._source['part5_zyh']);
        });

        const uniq_zyh = _.uniq(related_zyh);
        await queryHome(uniq_zyh).then(res => {
            ctx.body = {status: res};
        }).catch(e => {
            ctx.body = {status: e}
        })
    }).catch(e => {
        console.log(e);
        console.log('es down');
    });
});

async function queryHome(zyh_array) {
    const zyh = zyh_array.join(',');
    const home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    return db.query(`SELECT ${home_fields.join(',')} FROM FIRST_HOME WHERE part1_zyh IN (${zyh})`);
}

async function queryPatient(id, lsh) {
    const zyh = lsh.substr(7, 7);
    const home_data = db.query(`SELECT * FROM FIRST_HOME WHERE part1_pid = ${id}`);
    const advice_data = db.query(`SELECT * FROM FIRST_ADVICE WHERE part2_zyh = '${lsh}'`);
    const lis_data = db.query(`SELECT * FROM FIRST_LIS WHERE part3_zylsh = '${lsh}'`);
    const mazui_data = db.query(`SELECT * FROM FIRST_MAZUI WHERE part4_zylsh = '${lsh}'`);
    const results_data = db.query(`SELECT * FROM FIRST_RESULTS WHERE part5_zyh = ${zyh}`);
    return await Promise.all([home_data, advice_data, lis_data, mazui_data, results_data]);
}

module.exports = router;