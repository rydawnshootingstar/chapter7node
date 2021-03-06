const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

//we can't add a method to user, so we need to use a schema
var UserSchema = new mongoose.Schema({
    email: {type: String, required: true, trim: true, minlength: 5, unique: true,
        validate: {
            validator: validator.isEmail,
            message: '{VALUE} is not a valid email'
        }
    },
    password: {type:String, required: true, minlength: 6},
    tokens: [{
        access:{
            type: String,
            required: true
        },
        token: {
            type:String,
            required: true
        }
    }]
});

//we don't want to send the user the token info
UserSchema.methods.toJSON = function () {
    var user = this;
    //cast user as an object so we can use _.pick on it
    var userObject = user.toObject();

    return _.pick(userObject, ['_id', 'email']);
};

//instance method. remember that arrow functions do not bind THIS so we need to define it using reg syntax
UserSchema.methods.generateAuthToken = function () {
    var user = this;
    var access = 'auth';
    var token = jwt.sign({_id: user._id.toString(), access}, process.env.JWT_SECRET).toString();

    user.tokens.push({access, token});

    return user.save().then(()=> {
       return token;
    });
};

UserSchema.methods.removeToken = function (token){
    var user = this;
    //pull removes not just the property of token but the entire object associated with it, which is an array.
    return user.update({
            $pull:
                {
                    tokens: {token}
                }
            }
    );
};

//statics is how we make a model method rather than an instance method
UserSchema.statics.findByToken = function (token){
    //model becomes the this rather than the document
    var User = this;
    var decoded;

    try {
       decoded = jwt.verify(token, process.env.JWT_SECRET);
    }catch (e){
        //always reject the promise so that we don't return
        // return new Promise((resolve, reject)=> {
        //    reject();
        // });
        //short way
        return Promise.reject();
    }

    //return the promise in order to chain
    return User.findOne({
       _id: decoded._id,
        //nested object requires quotes for dot operation
       'tokens.token': token,
       'tokens.access': 'auth'
    });
};

UserSchema.statics.findByCredentials = function (email, password){
    var User = this;

    //return because we're chaining
    return User.findOne({'email': email}).then((user)=> {
       if(!user) {
           //reject promise from server.js
           return Promise.reject();
       }

       //making this a promise is the best practice for asynchronous code
       return new Promise((resolve, reject)=> {
          bcrypt.compare(password, user.password, (err, res) => {
              if(res){
                  resolve(user);
              }else {
                  reject();
              }
          });
       });
    });
};


UserSchema.pre('save', function (next) {
    var user = this;

    if(user.isModified('password')) {
         bcrypt.genSalt(10, (error, salt)=> {
            bcrypt.hash(user.password, salt, (err, hash)=> {
                user.password = hash;
                next();
            });
        });
    }else {
        next();
    }
});



// var User = mongoose.model('User', {
//     email: {type: String, required: true, trim: true, minlength: 5, unique: true,
//         validate: {
//             validator: validator.isEmail,
//             message: '{VALUE} is not a valid email'
//             }
//         },
//     password: {type:String, required: true, minlength: 6},
//     tokens: [{
//         access:{
//             type: String,
//             required: true
//         },
//         token: {
//             type:String,
//             required: true
//         }
//     }]
// });

var User = mongoose.model('User', UserSchema);
module.exports = {User};