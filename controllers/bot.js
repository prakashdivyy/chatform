const User = require('../models/User');
const Form = require('../models/Form');
const Responder = require('../models/Responder');
const request = require('request');
const Smooch = require('smooch-core');

/**
 * POST /bot/:formId
 *
 */
exports.postMessage = (req, res, next) => {
  //Get form
  Form.findById(req.params.formId, (err, form) => {
    if(err) {
      console.log(err);
      return res.sendStatus(500);
    }

    //Log in to Smooch
    const smooch = new Smooch({jwt: form.smoochToken});

    //Look up responder
    const appUser = req.body.appUser;
    Responder.findOne({'appUserId' : appUser._id}, (err, responder) => {

      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }

      if(!responder) {
        responder = new Responder({
          formId: req.params.formId,
          appUserId: appUser._id,
          appUser: appUser
        });

        responder.response = {};
      } else {
        //The message contained an answer to something that we want to track!
        var questionIndex = 0;

        if(responder.response) {
          questionIndex = Object.keys(responder.response).length;
          if(questionIndex >= form.fields.length) {
            return res.sendStatus(200);
          }
        } else {
          responder.response = {};
        }

        responder.response[form.fields[questionIndex].question] = req.body.messages[0].text;
        responder.markModified('response');
      }

      //Save response
      responder.save((err) => {
        if(err) {
          console.log(err);
          return res.sendStatus(500);
        }

        //Send next question or gtfo
        if(Object.keys(responder.response).length === form.fields.length) {
          //All questions have been answered

          if(form.endMessage && form.endMessage.length) {
            smooch.appUsers.sendMessage(appUser._id, {
                role: 'appMaker',
                type: 'text',
                text: form.endMessage
            }).then((response) => {
              return res.sendStatus(200);
            });
          } else {
            return res.sendStatus(200);
          }
        } else if(Object.keys(responder.response).length == 0) {
          //Starting off the survey

          if(form.startMessage && form.startMessage.length) {
            smooch.appUsers.sendMessage(appUser._id, {
                role: 'appMaker',
                type: 'text',
                text: form.startMessage
            }).then((response) => {
              smooch.appUsers.sendMessage(appUser._id, {
                  role: 'appMaker',
                  type: 'text',
                  text: form.fields[0].question
              }).then((response) => {
                return res.sendStatus(200);
              });
            });
          } else {
            smooch.appUsers.sendMessage(appUser._id, {
                role: 'appMaker',
                type: 'text',
                text: form.fields[0].question
            }).then((response) => {
              return res.sendStatus(200);
            });
          }
        } else {
          //Mid survey!
          smooch.appUsers.sendMessage(appUser._id, {
              role: 'appMaker',
              type: 'text',
              text: form.fields[Object.keys(responder.response).length].question
          }).then((response) => {
            return res.sendStatus(200);
          });
        }

      });

    });
});
}