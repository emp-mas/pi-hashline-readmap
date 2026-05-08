#!/usr/bin/env perl
use strict;
use warnings;
use Data::Dumper;
use JSON::PP qw(decode_json);
require My::Helper;

package MyApp::Service;

use constant MAX_RETRIES => 3;
use constant VERSION => '1.0';

=head1 NAME
MyApp::Service - A sample service module

=head1 SYNOPSIS
  use MyApp::Service;
  my $svc = MyApp::Service->new;
=cut

sub new {
    my ($class, %opts) = @_;
    return bless \%opts, $class;
}

sub process_data($self, $file) {
    # process something
}

sub _internal_helper {
    # private method
}

BEGIN {
    print "loading\n";
}

END {
    print "cleanup\n";
}

1;

__END__
This text should be ignored by the mapper.
sub fake_sub { }
