import express from 'express';
import passport from 'passport';

import threadsCtrl from '../controllers/threads.controller';

const router = express.Router(); // eslint-disable-line new-cap

router.use(passport.authenticate('jwt', { session: false }));

router.route('/')
    .post(threadsCtrl.create);

export default router;
