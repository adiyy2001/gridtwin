function ids = branch_ids(branch)
  define_constants;
  count = rows(branch);
  ids = cell(1, count);
  for k = 1:count
    isTransformer = branch(k, TAP) ~= 0;
    if isTransformer
      prefix = 'T';
    else
      prefix = 'L';
    end
    earlier = 1:k - 1;
    sameEnds = branch(earlier, F_BUS) == branch(k, F_BUS) & branch(earlier, T_BUS) == branch(k, T_BUS) ...
               & (branch(earlier, TAP) ~= 0) == isTransformer;
    ids{k} = sprintf('%s%d-%d', prefix, branch(k, F_BUS), branch(k, T_BUS));
    if any(sameEnds)
      ids{k} = sprintf('%s-%d', ids{k}, sum(sameEnds) + 1);
    end
  end
end
