// Essential for the roles package to initialise and check if the user is in roles for real
import { Roles } from 'meteor/alanning:roles';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
// import 'materialize-css/dist/css/materialize.min.css';
// import 'materialize-css/dist/js/materialize';
import '../imports/ui/stylesheets/wizard.css';
import '../imports/ui/stylesheets/loader.css';
import '../imports/ui/stylesheets/landing.css';
import '../imports/ui/stylesheets/header.css';
import '../imports/ui/stylesheets/overwrites.css';
import '../imports/ui/stylesheets/register.css';
import '../imports/ui/stylesheets/mainModal.css';
import '../imports/api/languages/language';
import './routes';
import './main.css';
import '../i18n/en.i18n.json';
import '../i18n/es.i18n.json';
import '../i18n/fr.i18n.json';
// import { La }

Meteor.startup(() => {
  Session.set({
    main: '#005555',
    isDark: false,
    mainDark: '#212121',
    bodyBackground: '',
  });
});

FlowRouter.wait();

Tracker.autorun(() => {
  if (Roles.subscription.ready() && !FlowRouter._initialized) {
    FlowRouter.initialize();
  }
});
