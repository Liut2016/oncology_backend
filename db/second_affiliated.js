const type = {
    // 首页part1， 收费part2


    // part3
    lis_type : [
        'VARCHAR(30)', 'VARCHAR(90)', 'INT', 'INT', 'INT', 'VARCHAR(30)', 'VARCHAR(90)', 'VARCHAR(300)', 'VARCHAR(300)'
        ,'VARCHAR(90)', 'VARCHAR(30)'
    ],
    // 病理表
    pathology_type : [
        'VARCHAR(30)','INT','VARCHAR(30)','VARCHAR(90)','VARCHAR(90)','VARCHAR(30)','VARCHAR(10)','VARCHAR(30)','VARCHAR(10)',
        'INT','VARCHAR(30)','VARCHAR(10)','VARCHAR(10)','VARCHAR(30)','VARCHAR(30)','VARCHAR(30)','VARCHAR(30)','VARCHAR(30)',
        'VARCHAR(300)','VARCHAR(30)','INT','VARCHAR(300)','VARCHAR(300)','VARCHAR(300)','VARCHAR(300)','VARCHAR(300)','VARCHAR(300)'
    ],

    // 骨密度对应基本信息表
    boneHome_type : [
        'INT','VARCHAR(30)','INT','VARCHAR(30)','INT','VARCHAR(10)','VARCHAR(10)','VARCHAR(10)','VARCHAR(10)','VARCHAR(30)','VARCHAR(30)','VARCHAR(30)',
        'VARCHAR(30)','VARCHAR(30)','VARCHAR(30)','VARCHAR(10)','VARCHAR(30)','VARCHAR(10)','VARCHAR(10)','VARCHAR(10)'
    ],

    // 骨密度
    boneDensity_type : [
        'INT','VARCHAR(10)','VARCHAR(30)','DECIMAL(10,5)','DECIMAL(10,5)','DECIMAL(10,5)','DECIMAL(10,5)','DECIMAL(10,5)'
    ],

    // 骨代谢
    vd_type : [
        'INT','VARCHAR(10)','VARCHAR(30)','DECIMAL(10,5)','DECIMAL(10,5)','DECIMAL(10,5)','DECIMAL(10,5)','DECIMAL(10,5)','DECIMAL(10,5)'
    ]
};

const key = {
    // 病理表
    pathology_key : [
        'hzxm','bah','blzdh','blrq','jbzd','zldx','t','lbjsl','n','yczyyw','yczywz','m','tnmfq','er','pr','her2','her2fish','ki67','bljgmyzhjgbz',
        'fzfx','xfzzl','xfzzlfa','xfzzlzq','xfzzlfa2','xfzzlpg1','xfzzlpg2','xfzzlpg3'
    ],

    // 骨密度对应基本信息表
    boneHome_key : [
        'bah','xm','xb','csrq','nl','cssf','csds','csdx','mz','sfzh','xzz','dh','hkdz','ryrqsj','cyrqsj','zyzdbm','zyzdjbms','sg','tz','bmi'
    ],

    // 骨密度
    boneDensity_key : [
        'bah','bw','rq','bmd','bmc','mj','z','t'
    ],

    // 骨代谢
    vd_key : [
        'bah','kb','jyrq','balp','osteoc','p1np','t25ohd','ipth','cross'
    ]
};

module.exports = {
    type,
    key
};