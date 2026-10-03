function options = reference_options(enforceQLimits)
  options = mpoption('verbose', 0, 'out.all', 0, 'pf.tol', 1e-12, 'pf.nr.max_it', 30, ...
                     'pf.enforce_q_lims', double(enforceQLimits));
end
