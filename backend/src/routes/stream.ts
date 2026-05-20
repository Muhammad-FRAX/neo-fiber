import { Router } from 'express';
import { alarmsStreamHandler } from '../streams/alarms.js';
import { topologyStreamHandler } from '../streams/topology.js';

const router = Router();

router.get('/alarms', alarmsStreamHandler);
router.get('/topology', topologyStreamHandler);

export default router;
