iD.ui.Splash = function(context) {
    return function(selection) {
        if (context.storage('sawSplash'))
             return;

        context.storage('sawSplash', true);

        var modal = iD.ui.modal(selection);

        modal.select('.modal')
            .attr('class', 'modal-splash modal col6');

        var introModal = modal.select('.content')
            .append('div')
            .attr('class', 'fillL');

        introModal.append('div')
            .attr('class','modal-section cf')
            .append('h3').text(t('splash.welcome'));

        introModal.append('div')
            .attr('class','modal-section')
            .append('p')
            .html(t('splash.text'));

        var buttons = introModal.append('div').attr('class', 'modal-actions cf');

        buttons.append('button')
            .attr('class', 'col6')
            .text(t('splash.walkthrough'))
            .on('click', function() {
                window.location = 'http://labs.strava.com/slide';
            });

        buttons.append('button')
            .attr('class', 'col6 start')
            .text(t('splash.start'))
            .on('click', modal.close);

        modal.select('button.close').attr('class','hide');

    };
};
