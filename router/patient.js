const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');

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
    Object.keys(conditions).forEach(key => {
        if (conditions[key] !== '') {
            condition_array.push(`${basic_conditions[key]} = '${conditions[key]}'`);
        }
    });
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
    let params = ctx.params;
    let {pid, zyh} = params;
    const home_sql = `select * from FIRST_HOME where part1_pid = ${pid}`;
    const advice_sql = `select * from FIRST_ADVICE where part2_zyh = '${zyh}'`;
    const home_part = await db.query(home_sql);
    const advice_part = await db.query(advice_sql);
    Promise.all([home_part, advice_part]).then(res => {
        res[1].forEach(item => {
            delete item['part2_pid'];
        });
        ctx.body = {...Tips[0], data: {home: res[0], advice: Utils.generateCategory(res[1], 'part2_yzlb')}}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason:e}
    });
});


//post方法实现二附院所有病人病案首页信息分页
router.post('/oa/patients2',async (ctx, next) =>{
    var pagesize = parseInt(ctx.request.body.pagesize);
    var pageindex = parseInt(ctx.request.body.pageindex);
    //var start = (pageindex-1) * pagesize;
    var start = pageindex -1;
    let sql1 = `SELECT * FROM SECOND_HOME limit ${start},${pagesize};`;
    let sql2 = 'SELECT COUNT(*) FROM SECOND_HOME;';
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

//给郑莹倩师姐：二附院根据表名和字段名提取该字段的所有数据
router.get('/oa/patients2/:table/:key',async(ctx,next) => {
    let params = ctx.params;
    //console.log(params);
    let {table,key} = params;
    //console.log(key);
    if (table === 'SECOND_HOME') id = 'part1_pid';
    else if (table === 'SECOND_FEE') id = 'part2_pid';
    else if(table === 'SECOND_LIS') id = 'part3_pid';
    const sql = `select ${id},${key} from ${table};`;
    await db.query(sql).then(res => {
        //Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

var isnum = function (x) {
    if(!Number.isNaN(parseFloat(x))) return 'number';
    else return 'string';
};

//给郑莹倩师姐：把二附院lis表所有的维度生成json
router.get('/oa/patients2/lisjson',async(ctx,next) => {
    const sql = 'SELECT part3_TEST_ORDER_NAME,part3_CHINESE_NAME,part3_QUANTITATIVE_RESULT FROM SECOND_LIS;';
    await db.query(sql).then(res => {
        let a = {};
        
        res.forEach(function(element){
            if (!a.hasOwnProperty(element.part3_TEST_ORDER_NAME))
            {
                a[element.part3_TEST_ORDER_NAME] = {};
            }
            let b = {};
            b[element.part3_CHINESE_NAME] = isnum(element.part3_QUANTITATIVE_RESULT);
            Object.assign(a[element.part3_TEST_ORDER_NAME],a[element.part3_TEST_ORDER_NAME],b);

        });
        ctx.body = {...Tips[0],'一般检查项目': a};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});

//给郑莹倩师姐：根据条件提取lis中的数据
router.post('/oa/patients2/lis',async(ctx,next) => {
    let testOrderName = ctx.request.body.testOrderName;
    let chineseName = ctx.request.body.chineseName;
    let sql = `SELECT * FROM SECOND_LIS WHERE part3_TEST_ORDER_NAME='${testOrderName}' AND part3_CHINESE_NAME='${chineseName}'`;
    await db.query(sql).then(res => {
        ctx.body = {...Tips[0],data:res};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});

//给许靖琴：二附院根据pid获取主页、费用和Lis信息
router.get('/oa/patient2/:pid',async(ctx,next) => {
    let params = ctx.params;
    let {pid} = params;
    
    let sql1 = `SELECT * FROM SECOND_HOME WHERE part1_pid=${pid};`
    await db.query(sql1).then(async(res) =>{
        let bah = res[0]['part1_bah'];
        let sql2 = `SELECT * FROM SECOND_FEE WHERE part2_bah=${bah};`;
        let sql3 = `SELECT * FROM SECOND_LIS WHERE part3_OUTPATIENT_ID=${bah};`;

        const part1 = await db.query(sql2);
        const part2 = await db.query(sql3);
        Promise.all([part1,part2]).then((res2) => {
            //console.log(res2);

            ctx.body = {...Tips[0],data_home:res,data_fee:res2[0],data_lis:Utils.generateCategory(res2[1],'part3_TEST_ORDER_NAME')};
        }).catch((e) => {
            ctx.body = {...Tips[1002],reason:e};
        })
    })
    
});

//给李安：获取二附院特定几列的数据
router.get('/oa/patients2/dashboard',async(ctx,next) => {
    let sql = 'SELECT part1_ylfkfs,part1_nl,part1_cssf,part1_csds,part1_ssmc FROM SECOND_HOME;'
    await db.query(sql).then(res => {
        let paymentMethod = [];
        let age = [];
        let province = [];
        let city = [];
        let surgicalName =[];
        res.forEach(function(element){
            paymentMethod.push(element.part1_ylfkfs);
            age.push(element.part1_nl);
            province.push(element.part1_cssf);
            city.push(element.part1_csds);
            surgicalName.push(element.part1_ssmc);
        });
        ctx.body = {...Tips[0],paymentMethod:paymentMethod,age:age,province:province,city:city,surgicalName:surgicalName};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});


module.exports = router;