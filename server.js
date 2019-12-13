var flash = require('connect-flash');
var express = require('express');
var app = express();
var expresssession = require('express-session');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var cookieParser = require('cookie-parser');
var MongoStore = require('connect-mongo')(expresssession);
var dbHelper = require('./app/dbhelper/server/db-helper.js');
var serverconfig = require('./config/serverconfig.json');
var Log = require('./app/log/server/log.js');
var path = require('path');
var user = require('./app/admin/server/fetchData/data/user.js');

app.use(function(req,res,next){
   // console.log(req.url);     
    res.setTimeout(360000, function () {
        InsertRecordOnTimeOutResponse(req, res);
        res.send({msg:'timeout response'})
    });
    next();
});

process.env.PORT = serverconfig.nodeserverport;
process.env.wordFilesDir = serverconfig.contentfolderpath;

//serverconfig.enviornment options development|test|production
if(serverconfig.enviornment!=undefined){
    process.env.NODE_ENV=serverconfig.enviornment;
}


var envior = process.env.NODE_ENV ;// serverconfig.enviornment;
if (envior == "test") {
    require.main.filename = __dirname + '/app';
    console.log("Testing enviornment running");
}
else {
    process.env.appDir = path.dirname(require.main.filename);
    console.log("Development enviornment running");
}
//rahul-for testing new admin page
//debugger;
//app.use(express.static(__dirname + '/app'));
//app.use('/', express.static('../../public/'));

//**********



app.locals.pretty = true;
app.set('port', process.env.PORT);
//app.set('views', __dirname + '/app/server/views');
var register = require('./register/registerviewspublic.js');
var viewslist = register.getDirPaths(__dirname + '/app', 'views');

//app.set('views', [__dirname + '/app/server/dashboard/views', __dirname + '/app/server/login/views']);
app.set('views', viewslist);
app.use(cookieParser());
app.use(bodyParser.json(({ limit: '50mb' })));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb', parameterLimit: 20000 })); // in case user passes more parameters.
//app.use(require('stylus').middleware({ src: __dirname + '/app/public' }));
//app.use(express.static(__dirname + '/app/public'));
//app.use('/', express.static(__dirname + '/app/public'));

var publiclist = register.getDirPaths(__dirname + '/app', 'public');

//setting cache control to no-store. this solves the issue of disappearing of icon from font-awesome.
app.use((req, res, next) => {
    if (!res.getHeader('Cache-Control')) {
        res.setHeader('Cache-Control', 'no-store');
    }
    next();
});

register.registerPublicfolders(app, express, publiclist);

app.use('/public2', express.static(__dirname + '/config'));
app.use('/images', express.static(__dirname + '/images'));
var swig = require('swig');
swig.setDefaults({
    varControls: ['[[', ']]']
});
app.set('view cache', false);
swig.setDefaults({ cache: false });
app.engine('html', swig.renderFile);
app.set('view engine', 'html');

//process.on('uncaughtException',(err)=>{
//    console.error(err.stack); 
//});

//app.use(flash());

//app.use(function (req, res, next) {
//    res.locals.success = req.flash('success');
//    res.locals.errors = req.flash('error');
//    next();
//});

// build mongo database connection url //



//if (app.get('env') == 'live') {
//    // prepend url with authentication credentials // 
//    dbURL = 'mongodb://' + process.env.DB_USER + ':' + process.env.DB_PASS + '@' + dbHost + ':' + dbPort + '/' + dbName;
//}


/*
app.use(session({
    secret: 'faeb4453e5d14fe6f6d04637f78077c76c73d1b4',
    proxy: true,
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({ url: dbURL })
}));
*/

var session;
if(process.env.NODE_ENV=="production"){
    session = expresssession({
        name: 'SESS_ID',
        secret: 'faeb4453e5d14fe6f6d04637f78077c76c73d1b4',
        proxy: true,
        resave: false,
        saveUninitialized: false,
        store: new MongoStore({ url: dbURL, ttl: (1 * 60 * 60) })
        ,cookie: { secure: true, httpOnly: true,maxAge:  (24*3600000) }
    });
}else{

    session = expresssession({       
        secret: 'faeb4453e5d14fe6f6d04637f78077c76c73d1b4',
        proxy: true,
        resave: false,
        saveUninitialized: false,
        store: new MongoStore({ url: dbURL, ttl: (1 * 60 * 60) })       
    })
}

app.use(session);

//Passport Authentication Start
passport = require('passport');
var pst=require('./app/passportauthentication/server/modules/passportauth')(app, passport);
isAuthenticated = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    else {
        //passport.authenticate('local', { failureRedirect: '/login' })
        res.redirect('/login');
    }
};
//Passport Authentication End

//JWT Passport Authentication Start
var jwtpassportauth = require('./app/jwtpassportauthentication/server/modules/jwtpassportmodule.js');
jwtpassportauth.addstrategy(app, passport);
//Global function for jwt authentication for any route
isJWTAuthenticated = function (req, res, next) {
    jwtpassportauth.isJWTAuthenticated(req, res, next);
};
//JWT Passport Authentication End

require('./register/registerroutes.js')(app);

var jsDAV = require("jsDAV/lib/jsdav");
var jsDAV_Locks_Backend_FS = require("jsDAV/lib/DAV/plugins/locks/fs");
//global.jsDAV_Locks_Backend_FS=jsDAV_Locks_Backend_FS;
//jsDAV.debugMode=true;

var dav=jsDAV.mount({
    node: __dirname + "/content",
    locksBackend: jsDAV_Locks_Backend_FS.new(__dirname + "/locks"),
    mount: "/api",
    server: app,
    standalone: false
});
global.jsDAV=dav;


app.use(function (req, res, next) {      
    if (req.url.search(/^\/api/) >= 0  ) { 
       dav.exec(req,res); 
        // if(req.query.sesessionid!=undefined){
        //   var Url=req.url.split('?');
        //   if(Url.length>1){
        //       req.url=Url[0];
        //      user.authanticatereq(req.query,function (err,suc){
        //          if(err){
                  
        //            res.redirect('/login');
        //          }
        //         else{
        //          if(suc.length>0){
        //               dav.exec(req,res); 
        //          }
        //         }
        //      });
        //   }
           
          
        //  }
        // else{
        //     //next();
        //      dav.exec(req,res); 
        //  }
   
       
    }
    else {
        next();
    }
}
)

/*if you want to display customr error page or messages instead of server error meassages displayed.*/
app.get('*', (req, res) => {
    res.status(404).send('not found.');
});
/****************************************** */

// app.use(function(req, res, next){
//     req.setTimeout(30000, function(){
//         console.log('Request has timed out.');
//             res.send(408);
//         });

//     next();
// });


var server;

if (serverconfig.ishttps == "true") {
    var https = require('https');
    var fs = require('fs');
    var options = {
        pfx: fs.readFileSync('./config/certificates/innodata.pfx'),
        passphrase: '1qaz!QAZ'

    };
    server = https.createServer(options, app);
    server.listen(app.get('port'), function () {
        console.log('Express https server listening on port ' + app.get('port'));

    });
} else {
    var http = require('http');
    server = http.createServer(app);
    server.listen(app.get('port'), function () {
        console.log('Express http server listening on port ' + app.get('port'));

    });
} 

var io = require('socket.io')(server, { 'pingInterval': 10000, 'pingTimeout': 5000 });
io.origins('*:*');
app.io = io;

const sharedsession = require('express-socket.io-session');
io.use(sharedsession(session));

require("./app/admin/server/fetchData/data/ConnectedUser")(io);
module.exports = app;