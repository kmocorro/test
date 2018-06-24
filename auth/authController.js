let jwt = require('jsonwebtoken');
let bodyParser = require('body-parser');
let config = require('./config');
let formidable = require('formidable');
let postgresql = require('../db/dbConfig');
let bcrypt = require('bcryptjs');
let uuidv4 = require('uuid/v4');

let nodemailer = require('nodemailer');
let mail = require('../mail/config');

let {OAuth2Client} = require('google-auth-library');
let CLIENT_ID = "120644413442-6km9fnqj8ttublf2392d3nenf5ls7voq.apps.googleusercontent.com";
let client = new OAuth2Client(CLIENT_ID);

module.exports = function(app){

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    /** Nodemailer transporter */
    let transporter = nodemailer.createTransport(mail.poolConfig);

    /**
     * GET | app login page.
     */
    app.get('/login', function(req, res){
        res.render('login');
    });
    app.get('/logout', function(req, res){
        res.cookie('auth', null);
        res.redirect('/');
    });

    /** POST API for user sign in validation */
    app.post('/api/oauth2google', function(req, res){

        let id_token = req.body; // id_token need to verify first.

        async function verify(){
            let ticket = await client.verifyIdToken({
                idToken: id_token.idtoken,
                audience: CLIENT_ID,
            });

            let payload = ticket.getPayload(); // payload, contains claims 
            let userid = payload['sub'];
            
            
            //console.log(userid);
            return payload; // AHA! 
        }

        verify().then(function(payload){
            //console.log(payload);

            let check_email_if_exists = {
                text: 'SELECT * FROM app_google_signin WHERE payload_email = $1',
                values: [payload.email]
            }

            let insert_payload = {
                text: 'INSERT INTO app_google_signin (payload_email, signin, payload_name, payload_givenname, payload_lastname) VALUES ($1, $2, $3, $4, $5)',
                values: [payload.email, new Date(), payload.name, payload.given_name, payload.family_name]
            }

            /** CHECK IF EMAIL EXISTS THEN DON'T STORE TO DB */
            postgresql.pool.query(check_email_if_exists,function(err, check_results){
                if(err){return res.send({err: 'oauth2google | Error occured while connecting to database. | ' + err})};

                if(check_results.rowCount < 1){ // if payload.email does NOT exists.

                    postgresql.pool.query(insert_payload, function(err, results){ // single transaction
                        if(err){ return res.send({err: 'oauth2google | Error occured while connecting to database. | ' + err  })};
                        
                        if(results.command == 'INSERT'){
        
                            let token = jwt.sign({ id: payload.jti, claim: payload }, config.secret, {expiresIn: 86400});
                            res.cookie('auth', token);
                            res.status(200).send({auth: true, token: token});
        
                        } else {
        
                            res.send({err: 'Error occured while inserting to database.' });
        
                        }
        
                    });

                } else { // if already existed.

                    let token = jwt.sign({ id: payload.jti, claim: payload }, config.secret, {expiresIn: 86400});
                    res.cookie('auth', token);
                    res.status(200).send({auth: true, token: token});

                }

            });
            
        }).catch(console.error);

    });

    app.post('/api/login', function(req, res){

        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields, files){ // parse incoming form
            
            if(fields){
                let form_login_details = fields;

                if(form_login_details.email && form_login_details.password){
                    
                    let selectEmail = {
                        text: 'SELECT * FROM app_manual_signin WHERE email = $1',
                        values: [form_login_details.email]
                    }

                    postgresql.pool.query(selectEmail, function(err, results){
                        if(err){ return res.send({err: 'Error occured while connecting to database'})};

                        if(results.command == 'SELECT'){
                            
                            if(typeof results.rows[0] !== 'undefined' && results.rows[0] !== null){
                                
                                let isPasswordValid = bcrypt.compareSync(form_login_details.password, results.rows[0].encrypted_pw);

                                if(!isPasswordValid){

                                    res.send({err: 'Invalid email or password.'});

                                } else {

                                    let token = jwt.sign({ id: results.rows[0].id, claim: results.rows[0] }, config.secret, { expiresIn: 86400 });
                                    
                                    res.cookie('auth', token);
                                    res.status(200).send({ auth: 'Authenticated. Please wait...' });
                                }

                            } else {
                                res.send({err: 'Password does not match the email or the account does not exist.' });
                            }
                        } else {

                            res.send({err: 'Invalid query.'});

                        }
                    });
        
                } else {
                    res.send({err: 'Invalid email or password.'});
                }
            }

        });

    });

    app.post('/api/register', function(req, res){

        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){
            if(err){ return res.send({err: 'Unable to parse form that you have submitted. Try again.'})};

            if(fields){

                let form_register_details = fields;
                //console.log(form_register_details);

                let hashedBrown = bcrypt.hashSync(form_register_details.password);
                
                let payload = {
                    id : uuidv4(),
                    firstname : form_register_details.firstname,
                    lastname : form_register_details.lastname,
                    email : form_register_details.email,
                    password : hashedBrown
                }

                let token = jwt.sign({ id: payload.id, claim: payload }, config.secret, { expiresIn: 3600 });

                /** SETUP MAIL */ 
                let mailOptions = {
                    from: '"PCBuilderApp" <admin@pcbuilder.app>', //sender
                    to: form_register_details.email,
                    subject: 'Verify Email Address for PCBuilderApp', 
                    /** NEED TO MAKE TEMPLATE FOR THIS */
                    html: '<p>Hey ' + form_register_details.firstname + ', <br><br> Thanks for registering for an account on PCBuilderApp! <br>Before we get started, we just need to confirm that this is you. <br><br>Click below to verify your email address: <br><br><a href="http://localhost:7007/verifysignup?token=' + token + '" target="_blank">Verify Email Address Here</a>. <br><br> Have fun PC Builders! </p>'
                };

                transporter.sendMail(mailOptions, function(error, info){
                    if(error){ return res.send({err: '<center>Oops, there is a problem folding the email.<br> Please try it again. </center>'})};
                    res.send({auth: '<center>Email has been sent. <br> Please verify your email address.</center>'});
                });

            } else {
                res.sned({err: 'Invalid form or incomplete. Try again.'})
            }

        });

    });

    app.post('/api/forgotpassword', function(req, res){

        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){

            if(fields.email){

                let check_email_if_exists_forgot_password = {
                    text: 'SELECT * FROM app_manual_signin WHERE email = $1',
                    values: [fields.email]
                }

                console.log(check_email_if_exists_forgot_password);

                postgresql.pool.query(check_email_if_exists_forgot_password, function(err, check_results){
                if(err){ return res.send({err: 'Forgotpassword | Error connecting to database.'})};
                    
                    if(check_results.rowCount == 1){ 
                        // proceed to send email link to change password. using token expiry within 5 min timeframe.

                        if(check_results.rows[0]){

                            let payload = {
                                uuid: uuidv4(),
                                id: check_results.rows[0].id,
                                email: check_results.rows[0].email,
                                given_name: check_results.rows[0].given_name
                            }

                            let token = jwt.sign({ id: payload.id, claim: payload }, config.secret, {expiresIn: 300});

                            /** SETUP MAIL */ 
                            let mailOptions = {
                                from: '"PCBuilderApp" <admin@pcbuilder.app>', //sender
                                to: fields.email,
                                subject: 'Password Reset Request for PCBuilderApp', 
                                /** NEED TO MAKE TEMPLATE FOR THIS */
                                html: '<p>Hey ' + payload.given_name + ', <br><br> Your PCBuilderApp password can be reset by clicking the link below. <br><br>If you did not request a new password, please ignore this email. <br><br><a href="http://localhost:7007/reset?token=' + token + '" target="_blank">Reset Password Here</a>. <br><br> Thanks! </p>'
                            };

                            transporter.sendMail(mailOptions, function(error, info){
                                if(error){ return res.send({err: '<center>Oops, there is a problem folding the email.<br> Please try it again. </center>'})};
                                res.send({success: '<center>Request has been sent. <br> Please check your email address.</center>'});
                                console.log(info);
                            });

                        }

                    } else {

                        res.send({success: '<center>Request has been sent. <br> Please check your email address.</center>'});
                    }

                });

            }

        });


    });

    app.post('/api/resetpassword', function(req, res){
        
    });

    /** GET API for user verification signup link */
    app.get('/verifysignup', function(req, res){

        let clickVerificationLinkToken = req.query.token;

        if(clickVerificationLinkToken){

            function verifyLinkToken(){
                return new Promise(function(resolve, reject){

                    jwt.verify(clickVerificationLinkToken, config.secret, function(err, decoded){
                        if(err) {return res.status(200).render('signin')};
        
                        let verifiedClaim = decoded.claim;
                        
                        resolve(verifiedClaim);
                    });

                });
                
            }

            verifyLinkToken().then(function(verifiedClaim){
                //console.log(verifiedClaim);

                if(verifiedClaim){
                    console.log(verifiedClaim);

                    /** QUERY SELECT IF USER EXISTS */
                    let select_form_register_details = {
                        text: 'SELECT * FROM app_manual_signin WHERE email = $1',
                        values: [verifiedClaim.email]
                    }

                    /** QUERY INSERT TO POSTGRESQL */
                    let insert_form_register_details = { 
                        text: 'INSERT INTO app_manual_signin (email, signin, name, given_name, lastname, encrypted_pw) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                        values: [verifiedClaim.email, new Date(), verifiedClaim.firstname + ' ' + verifiedClaim.lastname, verifiedClaim.firstname, verifiedClaim.lastname, verifiedClaim.password] // password already encrypted here
                    }

                    postgresql.pool.query(select_form_register_details, function(err, check_results){
                        
                        console.log(check_results);

                        if(check_results.rowCount < 1){ // if account already exists

                            postgresql.pool.query(insert_form_register_details, function(err, results){ // single transaction
                                if(err){ return res.send({err: 'VerifySignup | Error occured while connecting to database. | ' + err  })};
                                
                                if(results.command == 'INSERT'){
        
                                    res.cookie();
        
                                    //let token = jwt.sign({ id: verifiedClaim.id, claim: verifiedClaim }, config.secret, { expiresIn: 86400 });
                                    //res.cookie('auth', token);
                                    res.render('verifytoken_success', {email: verifiedClaim.email});
        
                                } else {
        
                                    res.send({err: 'Error occured while inserting to database.' });
        
                                }
        
                            });

                        } else {

                            res.render('verifytoken_expired');

                        }

                    });

                    

                } else {
                    res.send({err: 'Verification link already expired.'});
                }
                

                
            });


        } else {
            res.status(200).render('signin');
        }

        

    });

    /** GET API for reset password */
    app.get('/reset', function(req, res){

        let clickResetLinkToken = req.query.token;

        if(clickResetLinkToken){

            function verifyLinkToken(){
                return new Promise(function(resolve, reject){

                    jwt.verify(clickResetLinkToken, config.secret, function(err, decoded){
                        if(err) {return res.status(200).render('resettoken_expired')};
        
                        let resetClaim = decoded.claim;
                        
                        resolve(resetClaim);
                    });

                });
                
            }

            verifyLinkToken().then(function(resetClaim){

                res.render('resetpassword', { email: resetClaim.email });

            });


        }

    });

}