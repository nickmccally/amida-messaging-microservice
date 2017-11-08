import express from 'express';
import validate from 'express-validation';
import paramValidation from '../../config/param-validation';
import messageCtrl from '../controllers/message.controller';
import auth from '../../config/passport';

const passportAuth = auth();
const router = express.Router(); // eslint-disable-line new-cap

router.use(passportAuth.authenticate);

router.route('/send')
    .post(validate(paramValidation.sendMessage), messageCtrl.send);

/**
 * url params:
 * - limit: number of messages to return
 * - from: filter on message sender by username
 * - summary: boolean, can return a summary version of messages
 */
router.route('/list/')
    .get(messageCtrl.list);

/**
 * url params:
 * - owner: username of owner of messages to count
 * - option: unread/all
 */
router.route('/count/')
    .get(messageCtrl.count);

router.route('/get/:messageId')
    .get(messageCtrl.get);

router.route('/delete/:messageId')
    .delete(messageCtrl.remove);

router.route('/archive/:messageId')
    .put(messageCtrl.archive);

/** Load message when API with route parameter is hit */
router.param('messageId', messageCtrl.load);

export default router;
