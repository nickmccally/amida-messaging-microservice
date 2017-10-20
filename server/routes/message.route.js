import express from 'express';
import validate from 'express-validation';
import paramValidation from '../../config/param-validation';
import messageCtrl from '../controllers/message.controller';

const router = express.Router(); // eslint-disable-line new-cap

router.route('/send')
    .post(validate(paramValidation.sendMessage), messageCtrl.send);

// userId should not exist;
// url should contain: ?limit=number, ?from=username, ?summary=true/false
router.route('/list/:limit')
    .get(messageCtrl.list);

// userId should not exist; adding 'owner' for now; remove after integrating with auth service;
// url should contain: ?owner=username, ?option=unread/all
router.route('/count/')
    .get(messageCtrl.count);

router.route('/get/:messageId')
    .get(messageCtrl.get);

router.route('/delete/:messageId')
    .delete(messageCtrl.remove);

/** Load message when API with route parameter is hit */
router.param('messageId', messageCtrl.load);

export default router;
